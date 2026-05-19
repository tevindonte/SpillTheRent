"""Shared address normalization and fuzzy matching for pipeline ingest scripts."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

from rapidfuzz import fuzz, process

SUFFIX_NORMALIZATIONS = (
    (re.compile(r"\bAVE\.?$"), "AVENUE"),
    (re.compile(r"\bAV\.?$"), "AVENUE"),
    (re.compile(r"\bST\.?$"), "STREET"),
    (re.compile(r"\bRD\.?$"), "ROAD"),
    (re.compile(r"\bDR\.?$"), "DRIVE"),
    (re.compile(r"\bBLVD\.?$"), "BOULEVARD"),
    (re.compile(r"\bPL\.?$"), "PLACE"),
    (re.compile(r"\bLN\.?$"), "LANE"),
    (re.compile(r"\bCT\.?$"), "COURT"),
    (re.compile(r"\bTER\.?$"), "TERRACE"),
    (re.compile(r"\bPKWY\.?$"), "PARKWAY"),
    (re.compile(r"\bSQ\.?$"), "SQUARE"),
    (re.compile(r"\bAPT\.?$"), "APARTMENT"),
)


def normalize_address(address: str | None) -> str:
    if not address:
        return ""
    addr = address.strip().upper()
    addr = re.sub(r"\s+", " ", addr)
    addr = re.sub(r"\s*-\s*", "-", addr)
    for pattern, replacement in SUFFIX_NORMALIZATIONS:
        addr = pattern.sub(replacement, addr)
    # Strip unit/apt suffixes for building-level match
    addr = re.sub(r"\s+(APT|APARTMENT|UNIT|#)\s+.*$", "", addr, flags=re.IGNORECASE)
    return addr.strip()


def build_address_from_parts(housenumber: Any, streetname: Any, zipcode: Any = None) -> str:
    parts = []
    if housenumber:
        parts.append(str(housenumber).strip())
    if streetname:
        parts.append(str(streetname).strip())
    base = " ".join(parts)
    if zipcode:
        base = f"{base} {str(zipcode).strip()}"
    return normalize_address(base)


def _house_number_key(address: str) -> str:
    parts = address.split(maxsplit=1)
    return parts[0] if parts else ""


class ComplexAddressIndex:
    """Index complexes by normalized address for rapidfuzz matching."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._id_by_address: dict[str, str] = {}
        self._addresses: list[str] = []
        self._by_house: dict[str, list[str]] = defaultdict(list)
        for row in rows:
            addr = normalize_address(row.get("address"))
            cid = row.get("id")
            if addr and cid and addr not in self._id_by_address:
                self._id_by_address[addr] = str(cid)
                self._addresses.append(addr)
                self._by_house[_house_number_key(addr)].append(addr)

    def match(self, address: str, threshold: int = 85) -> str | None:
        complex_id, _score, _addr = self.match_with_score(address, threshold=threshold)
        return complex_id

    def match_with_score(
        self, address: str, threshold: int = 85
    ) -> tuple[str | None, int, str | None]:
        """Return (complex_id, fuzzy score 0–100, matched normalized address)."""
        norm = normalize_address(address)
        if not norm:
            return None, 0, None
        if norm in self._id_by_address:
            return self._id_by_address[norm], 100, norm
        if not self._addresses:
            return None, 0, None

        house_key = _house_number_key(norm)
        candidates = self._by_house.get(house_key, [])
        result = self._extract_best(norm, candidates, threshold)
        if result is not None:
            return result
        if candidates and len(candidates) < len(self._addresses):
            result = self._extract_best(norm, self._addresses, threshold)
            if result is not None:
                return result
        return None, 0, None

    def _extract_best(
        self, norm: str, candidates: list[str], threshold: int
    ) -> tuple[str | None, int, str | None] | None:
        if not candidates:
            return None
        result = process.extractOne(
            norm,
            candidates,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=threshold,
        )
        if result is None:
            return None
        matched_addr, score, _ = result
        cid = self._id_by_address.get(matched_addr)
        if not cid:
            return None
        return cid, int(score), matched_addr

    def register(self, complex_id: str, address: str) -> None:
        """Add a complex to the index after inserting a new row."""
        norm = normalize_address(address)
        if not norm or not complex_id or norm in self._id_by_address:
            return
        self._id_by_address[norm] = str(complex_id)
        self._addresses.append(norm)
        self._by_house[_house_number_key(norm)].append(norm)
