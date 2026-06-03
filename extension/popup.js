const input = document.getElementById("apiBase");
const save = document.getElementById("save");

chrome.storage.sync.get(["apiBase"], (r) => {
  input.value = r.apiBase || "https://spillthe.rent";
});

save.addEventListener("click", () => {
  chrome.storage.sync.set({ apiBase: input.value.trim() }, () => {
    save.textContent = "Saved!";
    setTimeout(() => (save.textContent = "Save"), 1200);
  });
});
