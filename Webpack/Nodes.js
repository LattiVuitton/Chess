const { Chess } = require("chess.js");
const eval = require('./Evaluation');

function round(value, decimals) {
    return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
  }

var nodeID = -1
var moveID = -1

function getID() {
    nodeID++
    return nodeID
}

function getMoveID() {
    moveID++
    return moveID
}

class MoveObject {
    constructor(move) {
        this.move = move;
        this.id = getMoveID();
    }
}

class Node {

    updateNodeValue(newValue) {
        this.bestMoveValue = newValue;
        if (round(newValue, 4) === 0.5275) {
            console.log("\n-----------------------------------------------------------------\n")
            console.log("Setting node " + this.id + " to " + round(newValue, 4))
            console.log(this.action)
            console.log("Is it expanded? " + this.fullyExplored())
            if (this.fullyExplored()) {
                console.log(this.bestMoveObject)
                console.log(this.moves)
                console.log(this.childrenDict)
            }

        }
    }

    constructor(board, parent, moves, WorB, action, isComp) {

        // Visits are only counted during backpropagation
        this.visits = 1;
        this.nextMoveIndex = 0;
        this.id = getID();
        this.board = board;
        this.parent = parent;
        this.moves = moves;
        this.moveObjects = []
        this.childrenDict = new Object();
        this.WorB = WorB;
        this.action = action;

        this.ownerColor = 'b';

        if (WorB) {
            this.ownerColor = 'w';
        }

        // Evaluation is relative to the colour of the node.
        // E.g. black node with high black piece count has q > 0.5,
        //      irrespective of whether the node is a human or not.
        this.qValue = eval.pieceValue(this.board, this.ownerColor);

        // Used in backpropagation
        this.actionObject = null
        if (parent != null) {
            for (let i = 0; i < parent.moveObjects.length; i++){
                // console.log(parent.moveObjects[i].move)
                // console.log(parent.moves[i])
                // console.log("\n")
                if (parent.moves[i] === action) {
                    this.actionObject = parent.moveObjects[i]
                    break;
                }
            }
        }
        // this.bestMoveValue = this.qValue;
        // console.log("From node creation")
        this.updateNodeValue(this.qValue)

    }

    fullyExplored() {
        if (Object.keys(this.childrenDict).length === this.moves.length) {
            return true
        }
        return false
    }

    hasNoMoves() {
        if (this.moves.length === 0) return true
        return false
    }

    matchesAgentColor(agentColor) {
        if (this.WorB === agentColor) {
            return true;
        }

        return false;
    }

    getOppColor(color) {
        if (color === 'w') {
            return 'b'
        }

        if (color === 'b') {
            return 'w'
        }

        else {
            console.log("error!")
            return null;
        }
    }

    // Multi-arm bandit
    // Assumes that the node is expanded
    getNext() {

        if (Object.keys(this.childrenDict).length != this.moves.length) {
            console.log("MISTAKE! node requesting next without being expanded first")
            return null
        }

        // EPSILON
        var eps = Math.random()

        var THRESHHOLD = 0.2

        var givenMoveObject = null;

        if (this.nextMoveIndex <= this.moves.length - 1) {
            givenMoveObject = this.moveObjects[this.nextMoveIndex]
            this.nextMoveIndex++
        }

        else {
            // console.log("Completed node with id: " + this.id)
            // console.log("Moves: ")
            // console.log(this.moves)

            // console.log("here")
            if (eps < THRESHHOLD || this.bestMoveObject === null) {
                givenMoveObject = this.moveObjects[Math.floor(Math.random() * this.moveObjects.length)]
                // console.log("Giving move: " + givenMoveObject.move.to + " () " + givenMoveObject.move.color)
            }
    
            else {
                givenMoveObject = this.bestMoveObject
            }
        }

        // console.log(this.childrenDict[givenMoveObject.id])
        // console.log(this.childrenDict[givenMoveObject.id].action.to + " <> " + round(this.childrenDict[givenMoveObject.id].qValue, 4)
        // + " (" + this.id + ")")
        return this.childrenDict[givenMoveObject.id]

    }

    // Returns the qValue of best node
    // OR qValue of worst node if isOpponent
    expand(AgentWorB) {

        // console.log("\nExpanding: " + this.id)

        var minQ = 100;
        var maxQ = -1;
        var bestActionObject = null;
        // console.log("\nStart")
        for (let i = 0; i < this.moves.length; i++){
            var givenMove = this.moves[i]
            var giveMoveObject = new MoveObject(givenMove);
            this.moveObjects.push(giveMoveObject)

            var nextState = new Chess(this.board.fen())
            nextState.move(givenMove)
            var nextMoves = nextState.moves({ verbose: true })

            // var nextNode = new Node(nextState, this, nextMoves, !this.WorB, givenMove, this.getOppColor(this.ownerColor))
            var nextNode = new Node(nextState, this, nextMoves, !this.WorB, givenMove, true)

            // console.log("Move: " + nextNode.action.to + ", Q: " + round(nextNode.qValue, 4))

            if (this.matchesAgentColor(AgentWorB)) {

                if (nextNode.qValue < minQ) {
                    // console.log("Replacing " + minQ + " with " + nextNode.qValue)
                    minQ = nextNode.qValue
                    bestActionObject = giveMoveObject;
                }
            }
            else {
                if (nextNode.qValue > maxQ) {
                    // console.log("Replacing (max)" + maxQ + " with " + nextNode.qValue)
                    maxQ = nextNode.qValue
                    bestActionObject = giveMoveObject;
                }
            }
            this.childrenDict[giveMoveObject.id] = nextNode
        }
        // console.log("")

        // Updating best move from this node and value achieved
        this.bestMoveObject = bestActionObject;

        if (this.matchesAgentColor(AgentWorB)) {
            // console.log("MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN MIN")

            this.updateNodeValue(minQ)
            // this.bestMoveValue = minQ;
            return minQ;
        }
        // console.log("MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX MAX")

        this.updateNodeValue(maxQ)

        // this.bestMoveValue = maxQ;
        return maxQ;
    }
}

exports.getNewRoot = function getNode(board, parent, moves, WorB, action) {

    var ownedColor = 'b'
    if (WorB) {
        ownedColor = 'w'
    }

    var node = new Node(board, parent, moves, WorB, action, true)
    return node
}