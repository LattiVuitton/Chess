const { Chess } = require("chess.js");
const eval = require('./Evaluation');
const nodes = require('./Nodes');

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}
  
function invertEval(original) {
    if (original >= 0 && original <= 1) return 1 - original
    return null
}

class Agent{
    constructor(id, WorB) {
        this.id = id;
        this.WorB = WorB
        this.requiresVerbose = true
        this.requiresLastPlayerMove = false;
        this.offlineTreeBuilding = false;
        this.hasTimeLimit = false;
    }

    // moves can either be only names, or full move object array
    selectMove(board, moves) {
        return null
    }
}

class RandomAgent extends Agent{
    constructor(id, WorB) {
        super(id, WorB)
        this.requiresVerbose = false
    }

    selectMove(board, moves) {
        const move = moves[Math.floor(Math.random() * moves.length)]
        return move
    }
}

class AlwaysTake extends Agent{
    constructor(id, WorB) {
        super(id, WorB)
        this.requiresVerbose = true
    }

    selectMove(board, moves) {

        // If you can checkmate, do it
        for (let i = 0; i < moves.length; i++){
            const move = moves[i];
            var clonedBoard = new Chess(board.fen())
            clonedBoard.move(move)
            if (clonedBoard.isCheckmate()) {
                return move
            }
        }

        // If you can take a piece, do it
        for (let i = 0; i < moves.length; i++){
            const move = moves[i];
            if (board.get(move.to) != false) {
                return move
            }
        }

        // If you can check, do it
        for (let i = 0; i < moves.length; i++){
            const move = moves[i];
            var clonedBoard = new Chess(board.fen())
            clonedBoard.move(move)
            if (clonedBoard.isCheck()) {

                return move
            }
        }

        const move = moves[Math.floor(Math.random() * moves.length)]
        return move
    }
}

class GreedyAgent extends Agent{
    constructor(id, WorB) {
        super(id, WorB)
        this.requiresVerbose = true
        this.boardsGenerated = 0
    }   

    selectMove(board, moves) {
        var color = 'b'
        if (this.WorB) {
            color = 'w'
        }

        var bestMove = null
        var bestMoveValue = -1
        for (let i = 0; i < moves.length; i++){
            var clonedBoard = new Chess(board.fen())
            this.boardsGenerated += 1
            const move = moves[i]
            clonedBoard.move(move)

            // Using piece value evaluation
            // Previous action and evaluation irrelevant here
            const boardValue = eval.pieceValue(clonedBoard, color, null, 0)

            if (boardValue > bestMoveValue) {
                bestMove = move
                bestMoveValue = boardValue
            }
        }

        return bestMove
    }
}

class MCTSAgent extends Agent{
    constructor(id, WorB) {
        super(id, WorB)
        this.requiresVerbose = true
        this.rootNode = null
        this.rootID = -1
        this.allExpandedNodes = []
        this.requiresLastPlayerMove = true;
        this.offlineTreeBuilding = true;
        this.timeLimit = 1;
        this.hasTimeLimit = true;
        this.MIN_ROUNDS = 10;

        // Indicates what the opponent (human) is faced with at close
        // Used to retrieve tree from previous state
        // Value changes at the end of each move
        this.playerAvailableMoves = null;
        this.playerBoardState = null;

        this.MAX_PATH_LENGTH = 1000
        if (WorB) {
            this.turn = 1
        }
        else {
            this.turn = 2
        }
    }

    setTimeLimit(timeLimit) {
        this.timeLimit = timeLimit;
    }

    nodeVisited(nodeID) {
        for (let i = 0; i < this.allExpandedNodes.length; i++){
            if (nodeID === this.allExpandedNodes[i]) {
                return true
            }
        }
        return false
    }

    offlineImproveTree() {
        this.improveTree(true)
    }

    improveTree(offline) {

        // console.log("Improving")

        var searchNode = this.rootNode

        if (offline) {
            if (!searchNode.fullyExplored()) {
                searchNode.expand()
            }
            searchNode = this.rootNode.bandit(0.3)
        }

        var path = [searchNode]
        var activeNode = searchNode

        activeNode.visits++

        var expansionNeeded = true;

        // Selection
        while (activeNode.fullyExplored()) {

            if (activeNode.hasNoMoves()) {
                expansionNeeded = false;
                break;
            }

            if (path.length > this.MAX_PATH_LENGTH) {
                expansionNeeded = false;
                break;
            }

            activeNode = activeNode.bandit()
            activeNode.visits++
            path.push(activeNode)

            // // Adding to total visitations
            // if (!this.nodeVisited(activeNode.id)) {
            //     this.allExpandedNodes.push(activeNode.id)
            // }
        }

        var foundValue = 0

        // Expansion
        if (expansionNeeded) {
            foundValue = activeNode.expand(this.WorB)
        }


        var valueToAgent = 0
        var valueToPlayer = 0

        if (activeNode.matchesAgentColor(this.WorB)) {
            valueToPlayer = invertEval(foundValue);
            valueToAgent = foundValue;
        }

        else {
            valueToAgent = invertEval(foundValue);
            valueToPlayer = foundValue;
        }
        
        // Backprop
        // console.log("")

        // For all nodes except last node in path
        for (let j = path.length - 2; j >= 0; j--) {

            var pathNode = path[j]

            // If node is unexpanded (no children)
            if (!expansionNeeded && j === path.length) {
                console.log("No backprop here")
            }

            else {

                var keyValue = valueToPlayer;

                if (pathNode.matchesAgentColor(this.WorB)) {
                    keyValue = valueToAgent;
                }

                if (keyValue > pathNode.qValue) {
                    if (j === 1) {
                        // console.log("Useful")
                    }
                    pathNode.bestMoveObject = path[j+1].actionObject
                    pathNode.updateNodeValue(keyValue)
                }

                else {
                    break;
                }
            }
        }
        // console.log(path)
    }

    selectMove(board, moves) {

        this.allExpandedNodes = []

        var foundRootNode = false;


        if (this.playerAvailableMoves != null) {

            for (let i = 0; i < this.playerAvailableMoves.length; i++){

                var playerMove = this.playerAvailableMoves[i];
                var boardAfterPlayer = new Chess(this.playerBoardState.board.fen())
                boardAfterPlayer.move(playerMove.move)

                if (boardAfterPlayer.fen() === board.fen()) {
                    if (this.playerBoardState != null) {
                        this.rootNode = this.playerBoardState.childrenDict[playerMove.id]
                        foundRootNode = true;
                    }
                }
            }
        }

        // Root node returned is faulty OR couldnt retrieve root
        if (this.rootNode === null || !foundRootNode) {
            this.rootNode = nodes.getNewRoot(board, null, board.moves({ verbose: true }), this.WorB, null)
            console.log("Couldnt retrieve, giving new: " + this.rootNode.id)
        }

        else {
            console.log("Found!")
        }

        this.turn++

        // Time loop
        var timeLimitSeconds = this.timeLimit * 1000
        const start = Date.now()

        // Think for at least this number of rounds
        // Required for avoiding no child expansion
        var roundsCount = 0

        while (Date.now() - start < timeLimitSeconds || roundsCount < this.MIN_ROUNDS) {
            roundsCount++
            this.improveTree(false)
        }

        var bestMove = null
        var bestQ = -1
        var playerState = null

        // For clean code
        var dictLen = Object.keys(this.rootNode.moveObjects).length

        for (let i = 0; i < dictLen; i++) {
            var moveObject = this.rootNode.moveObjects[i]

            var opponentNode = this.rootNode.childrenDict[moveObject.id]

            console.log("\nMove: " + moveObject.move.to)
            console.log("Value: " + round(invertEval(opponentNode.qValue), 4))
            console.log("Visits: " + opponentNode.visits)

            if (invertEval(opponentNode.qValue) > bestQ) {
                bestMove = moveObject.move;
                bestQ = invertEval(opponentNode.qValue);
                playerState = opponentNode;
            }
        }

        if (!playerState.fullyExplored()) {
            // playerState.expand()
        }

        // Clear moves available to opponent (human)
        this.playerAvailableMoves = []

        // State of board being delivered to opponent
        for (let i = 0; i < playerState.moveObjects.length; i++){

            // Add move to player moves
            this.playerAvailableMoves.push(playerState.moveObjects[i]);

        }

        // Board state being left to player
        this.playerBoardState = playerState;
        this.rootNode = playerState
        
        // Best move after Q-value analysis
        // console.log(round(bestQ,4))

        return bestMove
    }
}

class LightMCTS extends Agent{
    constructor(id, WorB) {
        super(id, WorB)
        this.requiresVerbose = true
        this.rootNode = null
        this.rootID = -1
        this.allExpandedNodes = []
        this.requiresLastPlayerMove = true;
        this.offlineTreeBuilding = true;
        this.timeLimit = 1//0.1;
        this.hasTimeLimit = true;
        this.MIN_ROUNDS = 10;

        // Indicates what the opponent (human) is faced with at close
        // Used to retrieve tree from previous state
        // Value changes at the end of each move
        this.playerAvailableMoves = null;
        this.playerBoardState = null;

        this.MAX_PATH_LENGTH = 1000
        if (WorB) {
            this.turn = 1
        }
        else {
            this.turn = 2
        }

        // Board constantly being updated
        this.testGame;
    }

    setTimeLimit(timeLimit) {
        this.timeLimit = timeLimit;
    }

    invertQvalue(value) {
        return 1 - value;
    }

    offlineImproveTree() {
        // this.improveTree(true)
    }

    improveTree() {

        // console.log("Improving Tree")

        if (this.rat === undefined) {
            this.rat = 0
        }
        else {
            this.rat++
        }

        let searchNode = this.rootNode;
        let path = [searchNode];

        while (searchNode.visits > 0) {

            if (!searchNode.movesDiscoverd) {
                searchNode.discoverMoves(this.testGame.moves());
                searchNode.movesDiscoverd = true;
            }

            let next = searchNode.bandit()

            // No moves available
            // Search node is a terminal node
            if (next === -1) {
                break;
            }

            searchNode = next

            path.push(searchNode)
            this.testGame.move(searchNode.action)
        }

        let preQ = -1;
        if (searchNode.parent != undefined) {
            preQ = searchNode.parent.qValue
        }

        // For unknown reason, node has simply not discovered moves yet
        if (!searchNode.movesDiscoverd) {
            searchNode.discoverMoves(this.testGame.moves());
            searchNode.movesDiscoverd = true;
        }

        if (searchNode.moves.length === 0) {

            // Node is a terminal position
            if (this.testGame.isCheckmate()) {
                searchNode.setQValue(0);
            }

            else {
                searchNode.setQValue(0.5);
            }
        }

        else {
            searchNode.setQValue(eval.getQValue(this.testGame, searchNode.action, preQ, searchNode.WorB));
        }

        for (let i = path.length - 1; i >= 0; i--){
            this.testGame.undo(path[i].action)
            path[i].visits++
            if (i < path.length - 1) {
                if (this.invertQvalue(path[i + 1].qValue) > path[i].qValue) {
                    // console.log("Updating node's value from " + path[i].qValue + " to " + this.invertQvalue(path[i + 1].qValue) + " " + i + " " + path[i].id)
                    path[i].qValue = this.invertQvalue(path[i + 1].qValue);
                }
            }
        }
    }

    selectMove(board, moves) {

        this.turn++

        // Time loop
        const start = Date.now()

        // Think for at least this number of rounds
        // Required for avoiding no child expansion
        var roundsCount = 0

        this.rootNode = nodes.getLightNode(null, this.WorB, null, board);
        this.testGame = new Chess(this.rootNode.board.fen());

        this.rat = 0;

        while (Date.now() - start < (this.timeLimit * 1000) || roundsCount < this.MIN_ROUNDS) {
            roundsCount++
            this.improveTree()
        }

        var counting = 0;

        let bestQValue = -1;
        let bestAction = null;

        console.log("-----------------------------\n")

        for (var moveKey in this.rootNode.children) {
            console.log("\nMove: " + moveKey)
            console.log("Value: " + this.invertQvalue(this.rootNode.children[moveKey].qValue))
            console.log("Visits: " + this.rootNode.children[moveKey].visits)
            counting += this.rootNode.children[moveKey].visits

            if (this.invertQvalue(this.rootNode.children[moveKey].qValue) > bestQValue) {
                bestAction = moveKey;
                bestQValue = this.invertQvalue(this.rootNode.children[moveKey].qValue);
            }
        }
        console.log("Count: " + this.rat)

        return bestAction
    }
}

var agentTypesDict = {
    "random": RandomAgent,
    "alwaysTake": AlwaysTake,
    "greedy": GreedyAgent,
    "MCTS": MCTSAgent,
    "LightMCTS": LightMCTS
};

exports.getAgent = function getAgentType(agentType, id, WorB) {

    const validAgentNames = Object.keys(agentTypesDict)

    for (var i = 0; i < validAgentNames.length; i++){

        if (validAgentNames[i] === agentType) {
            const agent = new agentTypesDict[agentType](id, WorB)
            return agent
        }
    }

    return null
}