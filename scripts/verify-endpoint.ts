import { spawn } from "child_process";

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkHealth() {
  try {
    const res = await fetch("http://localhost:5000/api/health");
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log("Waiting for server...");
  let attempts = 0;
  while (attempts < 30) {
    if (await checkHealth()) {
      console.log("Server is up!");
      break;
    }
    await wait(1000);
    attempts++;
  }

  if (attempts >= 30) {
    console.error("Server failed to start");
    process.exit(1);
  }

  // Login
  console.log("Logging in...");
  const loginRes = await fetch("http://localhost:5000/api/admin/login", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:5000",
        "Referer": "http://localhost:5000/admin"
    },
    body: JSON.stringify({ password: "Password1" })
  });

  if (!loginRes.ok) {
    console.error("Login failed", await loginRes.text());
    process.exit(1);
  }

  const cookie = loginRes.headers.get("set-cookie");
  console.log("Logged in, cookie:", cookie);

  // Validate URLs
  console.log("Validating URLs...");
  const validateRes = await fetch("http://localhost:5000/api/admin/validate-urls", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie || "",
      "Origin": "http://localhost:5000",
      "Referer": "http://localhost:5000/admin"
    },
    body: JSON.stringify({ urls: ["https://example.com/test", "https://example.com/unknown"] })
  });

  if (!validateRes.ok) {
    console.error("Validation failed", await validateRes.text());
    process.exit(1);
  }

  const results = await validateRes.json();
  console.log("Validation results:", JSON.stringify(results, null, 2));

  console.log("Verification successful!");
  process.exit(0);
}

main();
