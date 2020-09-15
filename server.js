const express = require("express")
//require = "include" -> npm i <nome da biblioteca>
//chama o construtor para não ser necessário estar sempre a chamar o express()
const app = express()

//"include" -> npm i cookie-parser
const cookie = require("cookie-parser")

//inserido um default engine
app.set('view engine', 'ejs');
app.use(cookie())
app.use(express.static(__dirname + '/views'));

var servers = [];

var normalData = ["Mirage","Inferno","Dust2","Nuke","Overpass","Vertigo","Train"];
customData = []
//customData.push("try")

app.get("/", (req, res) => {
    res.render("home")
})

//Fazer Picks [Kick] [Pick] [Kick] [Pick] [Kick] [Pick]
app.get("/pick/:type", (req, res) => {
    if(req.cookies["Data"] != undefined)
        customData = req.cookies["Data"].split(',');
    if(req.params.type == "normal")
       res.render("createPicks", {numberData: normalData.length})
    else
       if(req.params.type == "custom")
        res.render("createPicks", {numberData: customData.length}) 
 
})

 app.get("/pick/:type/:picks", (req, res) => {
    //criar um id aleatorio do lobby
    var idLobby = Math.floor(Math.random() * 10000)
    var server = { id: idLobby, picks: req.params.picks, type: req.params.type, log: [], spectators: [], plays: 0 }
    if(server.type == "normal")
        server.data = normalData;
    else {
        server.data = req.cookies["Data"].split(',');
        res.clearCookie('Data');
    }
    
    //é inserido nos servers os conjuntos de server{id, picks, ...}
    servers.push(server)
    //res.redirect(`/lobby/${idLobby}`)
    res.redirect("/lobby/" + idLobby)
})

app.get("/custom", (req, res) => {
    res.render("createCustom")
})

app.get("/lobby/:id", (req, res) => {
    var server = findServer(req.params.id)
    if(server == null)
        res.redirect('/')
    else {
        res.render("csgoDefault", { server: req.params.id, data:  server.data, log: server.log})//log - [kick ou pick, mapa]
    }
})

//localhost:8080
const serverListen = app.listen(80)

// io -> socket "chamar" a library socket.io
const io = require('socket.io').listen(serverListen);

io.on("connect", (socket) => {
    socket.on("ready", function(id) {
        var server = findServer(id)
        //console.log(`User entered on serverID: ${server.id}`);
        console.log("user entered on serverID: " + server.id)
        if(server.player1 == undefined || server.player2 == undefined) {
            if(server.player1 == undefined)
                server.player1 = socket
            else
                if(server.player2 == undefined)
                    server.player2 = socket
            
            if(server.player1 != undefined && server.player2 != undefined)
            {
                var pick = pickFunction(server);

                if(pick == false) //é devolvido false quando é kick
                    server.player1.emit("voting", "nao")
                else 
                    server.player1.emit("voting", "sim")
            }
        } else {
            server.spectators.push(socket);
        }
    })

    socket.on('vote', function(type, map, id) {
        var server = findServer(id)

        if(server != null) {
            server.plays++;
            if(server.player1 == socket) {
                server.player1.emit("stop");
                if(server.player2 != undefined) {
                    server.player2.emit('vote', type, map)
                }
            }
            else {
                server.player2.emit("stop");
                if(server.player1 != undefined) {
                    server.player1.emit('vote', type, map)
                }
            }
            server.log.push({type: type, map: map});
            sendSpectator(server.spectators, 'vote', type, map);

            if(pickFunction(server) == false) // Ver se é Pick ou Kick devolve falso se for KICK
                playerPicking(server).emit('voting', 'nao') // PlayerPicking vê o player que irá jogar, em seguida é emitida a informação para esse jogador
            else 
                playerPicking(server).emit('voting', 'sim')

            console.log("Houve um(a) " + type + " no dado: " + map + " no servidor: " + id);

            if(server.plays == server.data.length)
                console.log(server.log);
        }
    })
    
    //quando um dos utilizadores se desconecta
    socket.on("disconnect", function() {
        var server = findUser(socket);
        if(server != null)
        {
            console.log("User Disconnected from Lobby " + server.id);
            if(server.player1 == socket) {
                server.player1 = undefined;
                if(server.player2 != undefined)
                    server.player2.emit('exit') //exit -> sai 1 user saem todos || stop -> espera por um novo user
            }
            else{
                server.player2 = undefined;
                if(server.player1 != undefined)
                    server.player1.emit('exit') //exit -> sai 1 user saem todos || stop -> espera por um novo user
            }

            if(server.player1 == undefined && server.player2 == undefined) {
                sendSpectator(server.spectators, 'exit');
                servers.splice(findServerIndex(server.id),1);
            }
        }
    })
})

function findServer(id){
    for(i = 0; i < servers.length; i++){
        if(servers[i].id == id){
            return servers[i];
        }
    }
    return null;
}

function findServerIndex(id){
    for(i = 0; i < servers.length; i++){
        if(servers[i].id == id){
            return i;
        }
    }
    return null;
}

function pickFunction(server) {
    var picks = server.picks.split(',');
    for(i = 0; i < picks.length; i++){
        if(picks[i] == server.plays){
            return true;
        }
    }
    return false;
}

function findUser(socket) {
    for(i = 0; i < servers.length; i++) {
        if(servers[i].player1 == socket)
            return servers[i];
        if(servers[i].player2 == socket)
            return servers[i];
    }
    return null;
}

function sendSpectator(arraySockets,sendString, type, map) {
    for(i = 0; i < arraySockets.length; i++) {
        arraySockets[i].emit(sendString, type, map);
    }
}

function playerPicking(server) {
    if(server.plays % 2 == 0)
        return server.player1;
    else
        return server.player2;
}
