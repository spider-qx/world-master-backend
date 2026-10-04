const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let database = {
    universes: [
        {
            id: "default_world",
            name: "Premier Elite Universe",
            admin: "Spider23qX",
            laws: "1. Financial Fair Play active.\n2. Transfer caps enforced by Aya.",
            activeTournament: "World Master League Cup",
            newsletters: ["📰 [FA Gazette]: Welcome to the Premier Elite Universe."],
            transferMarket: [
                { id: 101, name: "Mateo Fernandez", pos: "RW", age: 21, ovr: 83, price: 16000000 },
                { id: 102, name: "Pep Lijnders", pos: "Head Coach", age: 43, ovr: 85, price: 5000000 }
            ],
            clubs: {
                "apex_fc": {
                    name: "Apex FC",
                    owner: "Spider23qX",
                    budget: 35000000,
                    stadiumCap: 40000,
                    matchday: 1,
                    coach: { name: "Unassigned", rating: 0 },
                    squad: [
                        { name: "Marcus Vance", pos: "ST", age: 25, ovr: 85, wage: 55000 }
                    ]
                }
            }
        }
    ]
};

app.get('/api/universes', (req, res) => {
    res.json(database.universes);
});

app.post('/api/universes', (req, res) => {
    const { name, admin } = req.body;
    const newId = "world_" + Date.now();

    const newWorld = {
        id: newId,
        name,
        admin,
        laws: "1. FFP Active.\n2. Fair Bidding enforced by Aya.",
        activeTournament: "Inaugural Universe Cup",
        newsletters: [`📰 [FA Gazette]: Universe '${name}' created by ${admin}.`],
        transferMarket: [
            { id: Date.now() + 1, name: "Mikel Arteta Jr", pos: "Head Coach", age: 44, ovr: 88, price: 7000000 }
        ],
        clubs: {}
    };

    database.universes.push(newWorld);
    res.json({ success: true, world: newWorld });
});

app.post('/api/universes/:worldId/join', (req, res) => {
    const { worldId } = req.params;
    const { managerName, clubName } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let clubKey = clubName.toLowerCase().replace(/\s+/g, '_');

    if (!world.clubs[clubKey]) {
        world.clubs[clubKey] = {
            name: clubName,
            owner: managerName,
            budget: 35000000,
            stadiumCap: 40000,
            matchday: 1,
            coach: { name: "Unassigned", rating: 0 },
            squad: [
                { name: "Starter Striker", pos: "ST", age: 24, ovr: 78, wage: 20000 }
            ]
        };
    }

    res.json({ success: true, world, clubKey });
});

app.post('/api/universes/:worldId/transfer', (req, res) => {
    const { worldId } = req.params;
    const { clubKey, itemId } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    let club = world.clubs[clubKey];
    let itemIndex = world.transferMarket.findIndex(i => i.id === itemId);

    if (itemIndex === -1) return res.status(400).json({ error: "Aya: Player or Coach already signed by another club!" });

    let item = world.transferMarket[itemIndex];

    if (club.budget < item.price) {
        return res.status(400).json({ error: "Aya: Transfer denied. Insufficient club funds." });
    }

    club.budget -= item.price;
    world.transferMarket.splice(itemIndex, 1);

    if (item.pos === "Head Coach") {
        club.coach = { name: item.name, rating: item.ovr };
    } else {
        club.squad.push({ name: item.name, pos: item.pos, age: item.age, ovr: item.ovr, wage: Math.round(item.price * 0.002) });
    }

    res.json({ success: true, world, club });
});

app.post('/api/universes/:worldId/admin', (req, res) => {
    const { worldId } = req.params;
    const { action, data } = req.body;

    let world = database.universes.find(w => w.id === worldId);
    if (!world) return res.status(404).json({ error: "Universe not found" });

    if (action === 'inject') {
        world.transferMarket.push({ id: Date.now(), ...data });
    } else if (action === 'tournament') {
        world.activeTournament = data.tournamentName;
        world.newsletters.unshift(`📰 [Tournament]: Admin launched '${data.tournamentName}'!`);
    } else if (action === 'newsletter') {
        world.newsletters.unshift(`📰 [Admin Dispatch]: ${data.text}`);
    }

    res.json({ success: true, world });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`World Master Backend Server running on port ${PORT}`));
