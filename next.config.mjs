// The seed audits are read with fs at runtime, so ship them with the audit function.
export default { outputFileTracingIncludes: { "/api/audit": ["./data/**"] } };
