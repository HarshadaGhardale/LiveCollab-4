async function getToken() {
  const res = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testuser123@example.com', password: 'password123' })
  });
  const data = await res.json();
  if (data.accessToken) {
    console.log(data.accessToken);
  } else {
    // try register
    const regRes = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'testuser123@example.com', username: 'testuser', password: 'password123' })
    });
    const regData = await regRes.json();
    console.log(regData.accessToken);
  }
}
getToken().catch(console.error);
