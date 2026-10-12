const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
    users: [],
    universes: [
        {
            id: "default_world",
            name: "Global PvP Championship",
            admin: "Spider23qX",
            matchday: 1,
            matchIntervalHours: 24, // Default to 24 hours between matchdays
            simulationRunning: false, // Matches do not start until admin gives the green light
            lastSimulationTime: null,
            fixtures: [],
            transferMarket: [
                { id: 101, name: "Kylian Mbappe Jr", pos: "ST", age: 22, ovr: 89, price: 45000000 },
                { id: 102, name: "Jürgen Klopp", pos: "Head Coach", age: 58, ovr: 91, price: 12000000 }
            ],
            clubs: {},
            matchesLog: []
        }
    ]
};

// --- LEAGUE AI BACKGROUND TICK (Automated Match Engine) ---
setInterval(() => {
    const now = Date.now();
    database.universes.forEach(world => {
        if (!world.simulationRunning || world.matchday > (world.fixtures.length || 0)) return;

        const intervalHours = world.matchIntervalHours || 24;
        const intervalMs = intervalHours * 60 * 60 * 1000;

        if (!world.lastSimulationTime) {
            world.lastSimulationTime = now;
        }

        if (now - world.lastSimulationTime >= intervalMs) {
            runMatchdaySimulation(world);
            world.lastSimulationTime = now;
        }
    });
}, 15000); // Check background timers every 15 seconds

function runMatchdaySimulation(world) {
    let currentRoundObj = world.fixtures.find(f => f.matchday === world.matchday);
    if (!currentRoundObj) return;

    let roundSummary = `=== [LEAGUE AI] AUTOMATED MATCHDAY ${world.matchday} RESULTS ===\n`;

    currentRoundObj.matches.forEach(match => {
        if (match.played) return;

        let homeClub = world.clubs[match.home];
        let awayClub = world.clubs[match.away];
        if (!homeClub || !awayClub) return;

        let homePower = homeClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (homeClub.squad.length || 1) + (homeClub.coach?.rating || 70);
        let awayPower = awayClub.squad.reduce((acc, p) => acc + p.ovr, 0) / (awayClub.squad.length || 1) + (awayClub.coach?.rating || 70);

        let homeGoals = Math.max(0, Math.floor((homePower / 40) + (Math.random() * 2.2) - 1));
        let awayGoals = Math.max(0, Math.floor((awayPower / 40) + (Math.random() * 2.2) - 1));

        homeClub.played++; awayClub.played++;
        homeClub.gf += homeGoals; homeClub.ga += awayGoals;
        awayClub.gf += awayGoals; awayClub.ga += homeGoals;

        if (homeGoals > awayGoals) {
            homeClub.won++; homeClub.points += 3; awayClub.lost++;
        } else if (homeGoals < awayGoals) {
            awayClub.won++; awayClub.points += 3; homeClub.lost++;
        } else {
            homeClub.drawn++; homeClub.points += 1; awayClub.drawn++; awayClub.points += 1;
        }

        match.played = true;
        match.score = `${homeGoals} - ${awayGoals}`;
        roundSummary += `⚽ ${homeClub.name} (${homeGoals}) - (${awayGoals}) ${awayClub.name}\n`;
    });

    world.matchesLog.unshift(roundSummary);
    world.matchday++;
}

// --- AUTHENTICATION ---
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields." });
    if (database.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: "Username already taken." });
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
    const { name, admin } = req.body;
    const newWorld = {
        id: "world_" + Date.now(),
        name,
        admin,
        matchday: 1,
        matchIntervalHours: 24,
        simulationRunning: false,
        lastSimulationTime: null,
        fixtures: [],
        transferMarket: [
            { id: Date.now(), name: "Zinedine Zidane", pos: "Head Coach", age: 53, ovr: 92, price: 15000000 }
        ],
        clubs: {},
        matchesLog: []
    };
    database.universes.push(newWorld);
    res.json({ success: true, world: newWorld });
});

app.delete('/api/universes/:worldId', (req, res) => {
    const { worldId } = req.params;
    const { adminName } = req.body;

    let index = database.universes.findIndex(w => w.id === worldId);
    if (index === -1) return res.status(404).json({ error: "Universe not found" });

    if (database.universes[index].admin.toLowerCase() !== adminName.toLowerCase()) {
        return res.status(403).json({ error: "Only the designated admin can delete this world." });
    }

    database.universes.splice(index, 1);
    res.json({ success: true });
});

// --- ADMIN CONFIGURATION (Match Duration & Start/Pause AI Simulation) ---
app.post('/api/universes/:worldId/config', (req, res) => {
    const { worldId } = req.params;
    const { adminName, matchIntervalHours, simulationRunning } = req.body;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    if (world.admin.toLowerCase() !== adminName.toLowerCase()) {
        return res.status(403).json({ error: "Only the verified world admin can change simulation settings!" });
    }

    if (matchIntervalHours !== undefined) {
        world.matchIntervalHours = Math.max(1, Math.min(24, Number(matchIntervalHours)));
    }
    if (simulationRunning !== undefined) {
        world.simulationRunning = Boolean(simulationRunning);
        if (world.simulationRunning && !world.lastSimulationTime) {
            world.lastSimulationTime = Date.now();
        }
    }

    res.json({ success: true, world });
});

// --- JOIN / CREATE CLUB & GENERATE FIXTURES ---
app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { username, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');
    if (world.clubs[clubKey] && world.clubs[clubKey].owner !== username) {
        return res.status(400).json({ error: "Club name already claimed by another manager!" });
    }

    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: username,
            budget: 50000000,
            points: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
            coach: { name: "Free Agent Coach", rating: 70 },
            squad: [
                { name: "Star Forward", pos: "ST", age: 23, ovr: 80, wage: 30000 },
                { name: "Solid Midfielder", pos: "CM", age: 25, ovr: 78, wage: 25000 }
            ]
        };

        generateFixtures(world);
    }

    res.json({ success: true, world, clubKey });
});

// Helper: Round-Robin Tournament Fixture Generator
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

// --- TRANSFER MARKET ---
app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let { clubKey, itemId } = req.body;
    let club = world.clubs[clubKey];
    let index = world.transferMarket.findIndex(i => i.id === itemId);

    if (index === -1) return res.status(400).json({ error: "Item unavailable." });
    let item = world.transferMarket[index];
    if (club.budget < item.price) return res.status(400).json({ error: "Not enough budget." });

    club.budget -= item.price;
    world.transferMarket.splice(index, 1);

    if (item.pos === "Head Coach") {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: 20000 });
    }

    res.json({ success: true, world, club });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend online on port ${PORT}`));
