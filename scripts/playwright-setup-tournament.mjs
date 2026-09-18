import fs from "fs";

function adminPassword() {
  const env = fs.readFileSync("../.env", "utf8");
  const match = env.match(/ADMIN_PASSWORD=(.*)/);
  return match ? match[1] : "trinityadmin123";
}

async function api(path, init = {}, token) {
  const url = `http://127.0.0.1:4003${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    }
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${init.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

async function main() {
  console.log("Logging in via API as admin...");
  const auth = await api("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ identifier: "admin", password: adminPassword() })
  });

  console.log("Fetching formats...");
  const formats = await api("/tournament-formats", {}, auth.token);
  const format = formats.find(f => f.system === "DOUBLE_ELIMINATION");
  if (!format) throw new Error("Could not find DOUBLE_ELIMINATION format");

  console.log("Fetching games...");
  let games = await api("/games");
  if (games.length === 0) {
    console.log("No games found. Creating default game...");
    await api("/games", {
      method: "POST",
      body: JSON.stringify({ name: "Joust Default Game" })
    }, auth.token);
    games = await api("/games");
  }
  const game = games[0];

  console.log(`Creating Double Elimination tournament (Format ID: ${format.id})...`);
  const t = await api("/tournaments/createtournament", {
    method: "POST",
    body: JSON.stringify({
      name: `Grand Admin Tournament ${Date.now()}`,
      formatId: format.id,
      gameId: game.id,
      maxPlayers: 4,
      isPrivate: false,
      startNow: true
    })
  }, auth.token);
  console.log("Created tournament:", t.id);

  const now = Date.now();
  console.log("Adding 2 guests...");
  for (let i = 1; i <= 2; i++) {
    await api(`/tournaments/${t.id}/participants/guest`, {
      method: "POST",
      body: JSON.stringify({ username: `Guest ${i} ${now}` })
    }, auth.token);
  }
  
  console.log("Signing up 2 players...");
  const realPlayerIds = [];
  for (let i = 1; i <= 2; i++) {
    const pUsername = `p${i}_${now.toString().slice(-6)}`;
    await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ identifier: pUsername, email: `${pUsername}@test.com`, password: "password" })
    });
    const pAuth = await api("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ identifier: pUsername, password: "password" })
    });
    
    const payload = JSON.parse(Buffer.from(pAuth.token.split('.')[1], 'base64').toString());
    realPlayerIds.push(payload.id);
    
    console.log(`Joining tournament as ${pUsername}...`);
    await api(`/tournaments/${t.id}/participants/join`, {
      method: "POST",
      body: JSON.stringify({ userId: payload.id })
    }, pAuth.token);
  }

  console.log("Starting bracket...");
  await api(`/tournaments/starttournament/${t.id}`, {
    method: "POST"
  }, auth.token);

  console.log("Tournament started! Now resolving matches up to Grand Finals...");

  const getMatches = async () => {
    const tourney = await api(`/tournaments/${t.id}`);
    return tourney.rounds.flatMap(r => r.matches.map(m => ({ ...m, round: r })));
  }

  // Double elim 4 players:
  // Round 1 (Winners): Match A, Match B
  // Round 2 (Winners): Match C (Winners Final)
  // Round 1 (Losers): Match D
  // Round 2 (Losers): Match E (Losers Final)
  // Grand Finals: Match F

  const tourneyInit = await api(`/tournaments/${t.id}`);
  const realParticipantIds = tourneyInit.participants
    .filter(p => realPlayerIds.includes(p.userId))
    .map(p => p.id);

  let matches = await getMatches();
  let pending = matches.filter(m => m.status === 'PENDING' && m.player1Id && m.player2Id);

  while (pending.length > 0) {
    const m = pending[0];
    if (!m.nextMatchId) {
      console.log("Reached Grand Finals. Stopping.");
      break;
    }
    
    let winnerId = m.player1Id;
    if (realParticipantIds.includes(m.player2Id)) winnerId = m.player2Id;
    if (realParticipantIds.includes(m.player1Id)) winnerId = m.player1Id;
    
    console.log(`Resolving match ${m.id} (${m.round?.name || 'Round'}) - Winner: ${winnerId}`);
    await api(`/matches/${m.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ winnerId })
    }, auth.token);
    matches = await getMatches();
    pending = matches.filter(m => m.status === 'PENDING' && m.player1Id && m.player2Id);
  }

  console.log("Done! Tournament is ready.");
}

main().catch(console.error);
