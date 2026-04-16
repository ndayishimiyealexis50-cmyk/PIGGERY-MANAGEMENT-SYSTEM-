export const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

export const rwandaISO = () => {
  return new Date().toLocaleString("en-CA", {
    timeZone: "Africa/Kigali",
    hour12: false
  }).replace(", ", "T");
};

export const toDay = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" });

export const jbinAppend = async (binId, apiKey, data) => {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "GET",
    headers: { "X-Master-Key": apiKey }
  });
  const json = await res.json();
  const existing = Array.isArray(json.record) ? json.record : [];
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": apiKey },
    body: JSON.stringify([...existing, data])
  });
};
