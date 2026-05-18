"""Borough codes and API field mappings for NYC ingest pipelines."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BoroughConfig:
    code: str
    label: str
    pluto_code: str
    hpd_boro: str
    bedbug_borough: str
    dob_borough: str
    oath_borough: str
    hp_boroid: str
    dhcr_pdf_url: str
    dhcr_cache_name: str


BOROUGHS: dict[str, BoroughConfig] = {
    "MN": BoroughConfig(
        code="MN",
        label="Manhattan",
        pluto_code="MN",
        hpd_boro="MANHATTAN",
        bedbug_borough="MANHATTAN",
        dob_borough="MANHATTAN",
        oath_borough="MANHATTAN",
        hp_boroid="1",
        dhcr_pdf_url=(
            "https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/"
            "2025/12/2024-DHCR-Bldg-File-Manhattan.pdf"
        ),
        dhcr_cache_name="dhcr_manhattan.pdf",
    ),
    "BK": BoroughConfig(
        code="BK",
        label="Brooklyn",
        pluto_code="BK",
        hpd_boro="BROOKLYN",
        bedbug_borough="BROOKLYN",
        dob_borough="BROOKLYN",
        oath_borough="BROOKLYN",
        hp_boroid="3",
        dhcr_pdf_url=(
            "https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/"
            "2025/12/2024-DHCR-Bldg-File-Brooklyn.pdf"
        ),
        dhcr_cache_name="dhcr_brooklyn.pdf",
    ),
    "QN": BoroughConfig(
        code="QN",
        label="Queens",
        pluto_code="QN",
        hpd_boro="QUEENS",
        bedbug_borough="QUEENS",
        dob_borough="QUEENS",
        oath_borough="QUEENS",
        hp_boroid="4",
        dhcr_pdf_url=(
            "https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/"
            "2025/12/2024-DHCR-Bldg-File-Queens.pdf"
        ),
        dhcr_cache_name="dhcr_queens.pdf",
    ),
}


def get_borough(code: str) -> BoroughConfig:
    key = code.strip().upper()
    if key not in BOROUGHS:
        raise ValueError(f"Unknown borough code {code!r}. Use MN, BK, or QN.")
    return BOROUGHS[key]


def add_borough_cli_args(parser, *, default: str = "MN") -> None:
    parser.add_argument(
        "--borough",
        choices=sorted(BOROUGHS.keys()),
        default=default,
        help="PLUTO / ingest borough code (MN=Manhattan, BK=Brooklyn, QN=Queens)",
    )
