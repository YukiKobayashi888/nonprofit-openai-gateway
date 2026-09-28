async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const response = await fetch(`http://localhost:${port}/drafts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "donor_receipt",
      requestId: crypto.randomUUID(),
      donorName: "Maya Chen",
      organizationName: "Riverside Food Pantry",
      amount: 125,
      currency: "USD",
      receivedOn: "2026-09-05",
    }),
  });

  const result: unknown = await response.json();
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  console.log(result);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
