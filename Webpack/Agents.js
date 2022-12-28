const { Chess } = require("chess.js");
const eval = require('./Evaluation');
const nodes = require('./Nodes');

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
  }

class Agent{
    constructor(id, WorB) {
        this.id = id;
        this.WorB = WorB
        this.requiresVerbose = true
        this.requiresLastPlayerMove = false;
        this.offlineTreeBuilding = false;
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
            const boardValue = eval.pieceValue(clonedBoard, color)

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

    nodeVisited(nodeID) {
        for (let i = 0; i < this.allExpandedNodes.length; i++){
            if (nodeID === this.allExpandedNodes[i]) {
                return true
            }
        }
        return false
    }

    improveTree() {

        // console.log("Improving tree")

        var path = [this.rootNode]
        var activeNode = this.rootNode

        var expansionNeeded = true;
        var foundWin = false;
        var foundLoss = false;
        var foundDraw = false;
        
        // Selection
        while (activeNode.fullyExplored()) {

            if (activeNode.hasNoMoves()) {
                expansionNeeded = false;
                if (activeNode.board.isCheckmate()) {
                    if (activeNode.color === this.WorB) {
                        foundWin = true;
                    }
                    else {
                        foundLoss = true;
                    }
                }
                else {
                    foundDraw = true  
                }
                break;
            }

            if (path.length > this.MAX_PATH_LENGTH) {
                expansionNeeded = false;
                break;
            }

            activeNode = activeNode.getNext()
            path.push(activeNode)

            // Adding to total visitations
            if (!this.nodeVisited(activeNode.id)) {
                this.allExpandedNodes.push(activeNode.id)
            }
        }

        // console.log("Path Length: " + path.length)

        var foundValue = 0

        // Expansion
        if (expansionNeeded) {
            foundValue = activeNode.expand(this.WorB)

        }

        else if (foundDraw) {
            foundValue = 0.5
            console.log("Found Draw")
        }

        else if (foundWin) {
            foundValue = 1
            console.log("Found Win")
        }

        else if (foundLoss) {
            foundValue = 0
            console.log("Found Loss")
        }

        // Either min or max
        var childNodeValue = foundValue
        if (foundValue > 0.7) {
            // console.log("werc: " + foundValue)
        }

        if (foundLoss) {
            console.log("PATH: " + path.length)
        }

        // console.log(path)

        // Backprop
        for (let j = path.length - 2; j >= 0; j--) {
            var pathNode = path[j]
            pathNode.visits++

            // console.log(pathNode.id)

            // If node is unexpanded (no children)
            if (!expansionNeeded && j === path.length) {
                console.log("No backprop here")
            }

            // Last node in path does not need backprop
            else if (path.length > 1) {

                if (j === 0) {
                    console.log(pathNode)
                }

                if (pathNode.matchesAgentColor(this.WorB)) {

                    if (childNodeValue >= pathNode.bestMoveValue) {

                        // if (j === 0) {
                        //     console.log("Updating from " + pathNode.bestMoveObject.move.to + " to " + 
                        //         path[j + 1].actionObject.move.to + " with q: " + childNodeValue)
                        //     // console.log(pathNode.bestMoveObject)
                        //     // console.log(path[j + 1].actionObject)
                        // }


                        pathNode.bestMoveValue = childNodeValue;

                        // console.log("")
                        // console.log(path)
                        // console.log(j + " <> " + path.length)
                        // console.log(path[j+1])
                        pathNode.bestMoveObject = path[j + 1].actionObject

                        // UPDATE NEEDED FOR UPDATING BEST MOVE
                        // console.log("Replace 1, visits: " + pathNode.visits)
                        // console.log("ID: " + pathNode.id)
                        // console.log("Root" + this.rootNode.id)
                        for (let i = 0; i <  Object.keys(this.rootNode.moveObjects).length; i++){
                            if (pathNode.id === this.rootNode.childrenDict[this.rootNode.moveObjects[i].id].id) {
                                console.log("Useful update")
                            }
                        }
                    }

                    else {
                        break;
                    }
                }

                else {
                    if (childNodeValue < pathNode.bestMoveValue) {

                        pathNode.bestMoveValue = childNodeValue;
                        pathNode.bestMoveObject = path[j+1].actionObject

                        // // UPDATE NEEDED FOR UPDATING BEST MOVE
                        // console.log("Replace 2, visits: " + pathNode.visits)
                        // console.log("ID: " + pathNode.id)
                    }
                    else {
                        break;
                    }
                }
                //  = ((path[j].qValue * path[j].visits) + foundValue) / (path[j].visits + 1)
                // path[j].visits++
            }
        }
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
            console.log("Couldnt retrieve")
            this.rootNode = nodes.getNewNode(board, null, board.moves({ verbose: true }), this.WorB, null)
        }

        this.turn++

        // Time loop
        const timeLimit = 1
        const timeLimitSeconds = timeLimit * 1000
        const start = Date.now()
        while (Date.now() - start < timeLimitSeconds) {
            this.improveTree()
        }

        var bestMove = null
        var bestQ = -1
        var playerState = null

        // For clean code
        var dictLen = Object.keys(this.rootNode.moveObjects).length

        for (let i = 0; i < dictLen; i++) {
            var moveObject = this.rootNode.moveObjects[i]

            var opponentNode = this.rootNode.childrenDict[moveObject.id]
            // console.log(moveObject.move.to + " <> " + opponentNode.qValue)

            console.log("\nMove: " + moveObject.move.to)
            console.log("Value: " + round(opponentNode.bestMoveValue, 2))
            console.log("Visits: " + opponentNode.visits)


            if (opponentNode.bestMoveValue > bestQ) {
                bestMove = moveObject.move;
                bestQ = opponentNode.bestMoveValue;
                playerState = opponentNode;
            }
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
        this.rootNode = playerState;
        
        // Best move after Q-value analysis
        console.log(bestQ)
        return bestMove
    }
}

var agentTypesDict = {
    "random": RandomAgent,
    "alwaysTake": AlwaysTake,
    "greedy": GreedyAgent,
    "MCTS": MCTSAgent
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