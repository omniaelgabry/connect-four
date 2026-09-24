const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (update this in production to your frontend URL)
        methods: ["GET", "POST"]
    }
});

// Store active rooms and their players
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Handle joining a room
    socket.on('join_game', (data) => {
        const { roomCode } = data;
        
        // Initialize room if it doesn't exist
        if (!rooms[roomCode]) {
            rooms[roomCode] = {
                players: []
            };
        }

        const room = rooms[roomCode];

        // Only allow 2 players per room
        if (room.players.length >= 2) {
            socket.emit('room_full', { message: 'Room is already full.' });
            return;
        }

        // Add player to room
        room.players.push(socket.id);
        socket.join(roomCode);
        
        // Determine player number (Player 1 if first, Player 2 if second)
        const playerNumber = room.players.length; 
        
        console.log(`User ${socket.id} joined room ${roomCode} as Player ${playerNumber}`);
        
        // Let the player know they joined successfully
        socket.emit('joined_successfully', { player: playerNumber });

        // If the room is now full (2 players), notify both that the game is ready
        if (room.players.length === 2) {
            io.to(roomCode).emit('game_ready', { message: 'Opponent connected. Game starts now!' });
        }
    });

    // Handle dropping a piece
    socket.on('drop_piece', (data) => {
        const { roomCode, col, player } = data;
        
        // Broadcast the move to the OTHER player in the room
        socket.to(roomCode).emit('board_updated', {
            col: col,
            player: player
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        // Find which room the user was in and notify the opponent
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const playerIndex = room.players.indexOf(socket.id);
            
            if (playerIndex !== -1) {
                // Remove player from the room tracking
                room.players.splice(playerIndex, 1);
                
                // Notify remaining player that opponent left
                socket.to(roomCode).emit('opponent_disconnected', { message: 'Your opponent has left the game.' });
                
                // Clean up empty rooms
                if (room.players.length === 0) {
                    delete rooms[roomCode];
                }
                break;
            }
        }
    });
});

// A simple health check endpoint for Render
app.get('/', (req, res) => {
    res.send('Connect 4 Multiplayer Server is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
