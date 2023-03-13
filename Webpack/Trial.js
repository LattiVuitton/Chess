const chess = require('chess.js')

var game = new chess.Chess()

function playGame() {

    MAX_ROUNDS = 10

    var sumTimeTaken = 0
    var sumMovesPlayed = 0

    for (let i = 0; i < MAX_ROUNDS; i++){

        game.reset()
        var round = 0
        var start = Date.now();
    
        while (true) {
    
            if (game.isGameOver()) {
                break
            }
    
            const moves = game.moves()
            const move = moves[Math.floor(Math.random() * moves.length)]
            game.move(move)
            
            round++
        }

        timeTaken = Date.now() - start
    
        console.log("\nRounds played: " + round)
        console.log("Time Taken: " + (timeTaken) + " ms")

        sumMovesPlayed += round
        sumTimeTaken += timeTaken
    }

    averageMovesPlayed = sumMovesPlayed / MAX_ROUNDS
    averageTimeTaken = sumTimeTaken / MAX_ROUNDS

    console.log("\n--------------------")
    console.log("\nAverage Moves Played: " + Math.round(averageMovesPlayed))
    console.log("Average Time Taken: " + Math.round(averageTimeTaken) + " ms\n")

    const thinkingTimeSeconds = 1
    const thinkingTime = thinkingTimeSeconds * 1000

    console.log("When thinking for " + thinkingTimeSeconds +
        " seconds, I can simulate " + Math.round(thinkingTime / averageTimeTaken) + 
        " games, totalling " + Math.round(thinkingTime * averageMovesPlayed/ averageTimeTaken) + 
        " moves\n")

}

playGame()