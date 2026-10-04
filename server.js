const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Shared multiplayer game world state
let gameWorld = {
    clubs: {
        "apex_fc": {
            name: "Apex FC",
            budget: 35000000,
            matchday: 1,
            squad: [
                { name: "Marcus Vance", pos: "ST", age: 25, ovr: 85, wage: 55000, value: 14000000 }
            ]
        }
    },
    transferMarket: [
        { id: 1, name: "Mateo Fernandez", pos: "RW", age: 21, ovr: 83, price: 16000000 },
        { id: 2, name: "Jordan Henderson-Smith", pos: "CM", age: 26, ovr: 79, price: 9000000 },
        { id: 3, name: "Viktor Gyökeres Profile", pos: "ST", age: 27, ovr: 86, price: 24000000 }
    ]
};

// API: Get club and market state
app.get('/api/club/:id', (req, res) => {
    const clubId = req.params.id;
    const club = gameWorld.clubs[clubId] || gameWorld.clubs["apex_fc"];
    res.json({ club, transferMarket: gameWorld.transferMarket });
});

// API: Handle shared transfers between players
app.post('/api/club/:id/transfer', (req, res) => {
    const clubId = req.params.id;
    const { playerId } = req.body;
    
    let club = gameWorld.clubs[clubId] || gameWorld.clubs["apex_fc"];
    let playerIndex = gameWorld.transferMarket.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
        return res.status(400).json({ error: "Player already signed by another manager!" });
    }
    
    let player = gameWorld.transferMarket[playerIndex];

    if (club.budget < player.price) {
        return res.status(400).json({ error: "Insufficient club funds!" });
    }

    // Process transaction globally
    club.budget -= player.price;
    club.squad.push({ ...player, cond: "100%", wage: Math.round(player.price * 0.0025) });
    gameWorld.transferMarket.splice(playerIndex, 1);

    res.json({ success: true, club, transferMarket: gameWorld.transferMarket });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Multiplayer server running on port ${PORT}`));
