const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
    users: [],
    universes: []
};

// --- AUTHENTICATION ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields." });
    if (database.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: "Username taken." });
    }
    database.users.push({ username, password });
    res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    let user = database.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (!user) return res.status(400).json({ error: "Invalid credentials." });
    res.json({ success: true, username: user.username });
});

// --- UNIVERSE MANAGEMENT ---
app.get('/api/universes', (req, res) => res.json(database.universes));

app.post('/api/universes', (req, res) => {
    const { name, creator } = req.body;
    const newWorld = {
        id: "world_" + Date.now(),
        name,
        admin: null, // No initial admin until someone applies & wins/claims
        adminCandidate: creator,
        adminCandidateTimer: Date.now() + (2 * 60 * 1000), // 2 minutes from creation
        matchday: 1,
        fixtures: [],
        transferMarket: [],
        clubs: {},
        matchesLog: []
    };
    database.universes.push(newWorld);
    res.json({ success: true, world: newWorld });
});

// Apply / Claim Admin Role after 2 minutes or if uncontested
app.post('/api/universes/:worldId/claim-admin', (req, res) => {
    const { worldId } = req.params;
    const { username } = req.body;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "League not found." });

    if (world.admin) {
        return res.status(400).json({ error: "This league already has an active admin!" });
    }

    let timeLeft = world.adminCandidateTimer - Date.now();
    if (timeLeft > 0 && world.adminCandidate !== username) {
        return res.status(400).json({ error: `Another user applied first. Please wait ${Math.ceil(timeLeft / 1000)} seconds to contest or claim.` });
    }

    // Assign admin role
    world.admin = username;
    res.json({ success: true, world });
});

// Contest Admin Position
app.post('/api/universes/:worldId/contest-admin', (req, res) => {
    const { worldId } = req.params;
    const { username } = req.body;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "League not found." });
    if (world.admin) return res.status(400).json({ error: "Admin role is already locked." });

    world.adminCandidate = username;
    world.adminCandidateTimer = Date.now() + (2 * 60 * 1000); // Reset timer 2 mins for new contender
    res.json({ success: true, world, message: "Successfully contested admin position! Timer reset." });
});

// --- JOIN LEAGUE / CLUB CREATION ---
app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { username, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');
    if (world.clubs[clubKey] && world.clubs[clubKey].owner !== username) {
        return res.status(400).json({ error: "Club name already claimed!" });
    }

    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: username,
            budget: 50000000,
            points: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
            coach: { name: "Free Agent Coach", rating: 70 },
            squad: [
                { name: "Star Striker", pos: "ST", age: 23, ovr: 80, wage: 30000 }
            ]
        };
        generateFixtures(world);
    }

    res.json({ success: true, world, clubKey });
});

function generateFixtures(world) {
    let keys = Object.keys(world.clubs);
    world.fixtures = [];
    if (keys.length < 2) return;
    let list = [...keys];
    if (list.length % 2 !== 0) list.push("BYE");

    let totalRounds = list.length - 1;
    let half = list.length / 2;

    for (let round = 0; round < totalRounds; round++) {
        let matchdayFixtures = [];
        for (let i = 0; i < half; i++) {
            let home = list[i];
            let away = list[list.length - 1 - i];
            if (home !== "BYE" && away !== "BYE") {
                matchdayFixtures.push({ home, away, played: false, score: null });
            }
        }
        world.fixtures.push({ matchday: round + 1, matches: matchdayFixtures });
        list.splice(1, 0, list.pop());
    }
}

// --- ADMIN MARKET INJECTOR (PLAYERS & COACHES) ---
app.post('/api/universes/:worldId/admin/add-market-item', (req, res) => {
    const { worldId } = req.params;
    const { username, itemType, name, pos, age, ovr, price } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "League not found." });
    if (world.admin !== username) return res.status(403).json({ error: "Unauthorized: Admin access required." });

    let newItem = {
        id: Date.now(),
        type: itemType, // 'player' or 'coach'
        name,
        pos: itemType === 'coach' ? 'Head Coach' : pos,
        age: Number(age),
        ovr: Number(ovr),
        price: Number(price)
    };

    world.transferMarket.push(newItem);
    res.json({ success: true, world });
});

// Simulate Matchday
app.post('/api/universes/:worldId/simulate-matchday', (req, res) => {
    const { worldId } = req.params;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let currentRoundObj = world.fixtures.find(f => f.matchday === world.matchday);
    if (!currentRoundObj) return res.status(400).json({ error: "Tournament completed!" });

    let roundSummary = `=== MATCHDAY ${world.matchday} RESULTS ===\n`;
    currentRoundObj.matches.forEach(match => {
        if (match.played) return;
        let homeClub = world.clubs[match.home];
        let awayClub = world.clubs[match.away];

        let homePower = homeClub.squad.reduce((a, p) => a + p.ovr, 0) / homeClub.squad.length + homeClub.coach.rating;
        let awayPower = awayClub.squad.reduce((a, p) => a + p.ovr, 0) / awayClub.squad.length + awayClub.coach.rating;

        let homeGoals = Math.max(0, Math.floor((homePower / 40) + (Math.random() * 2) - 1));
        let awayGoals = Math.max(0, Math.floor((awayPower / 40) + (Math.random() * 2) - 1));

        homeClub.played++; awayClub.played++;
        homeClub.gf += homeGoals; homeClub.ga += awayGoals;
        awayClub.gf += awayGoals; awayClub.ga += homeGoals;

        if (homeGoals > awayGoals) { homeClub.won++; homeClub.points += 3; awayClub.lost++; }
        else if (homeGoals < awayGoals) { awayClub.won++; awayClub.points += 3; homeClub.lost++; }
        else { homeClub.drawn++; homeClub.points += 1; awayClub.drawn++; awayClub.points += 1; }

        match.played = true;
        match.score = `${homeGoals} - ${awayGoals}`;
        roundSummary += `⚔ ${homeClub.name} (${homeGoals}) - (${awayGoals}) ${awayClub.name}\n`;
    });

    world.matchesLog.unshift(roundSummary);
    world.matchday++;
    res.json({ success: true, world });
});

// Transfer Buy
app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    let world = database.universes.find(w => w.id === worldId);
    let { clubKey, itemId } = req.body;
    let club = world.clubs[clubKey];
    let index = world.transferMarket.findIndex(i => i.id === itemId);

    if (index === -1) return res.status(400).json({ error: "Item unavailable." });
    let item = world.transferMarket[index];
    if (club.budget < item.price) return res.status(400).json({ error: "Insufficient funds." });

    club.budget -= item.price;
    world.transferMarket.splice(index, 1);

    if (item.type === 'coach' || item.pos === 'Head Coach') {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: 20000 });
    }

    res.json({ success: true, world, club });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
