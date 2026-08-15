if (diff.inputType === "plain text") {

    function similarity(lineA, lineB) {
        let longest = lineA.wordCount >= lineB.wordCount ? lineA : lineB;
        let shortest = lineA.wordCount < lineB.wordCount ? lineA : lineB;
        if (allWordsOf(shortest).areIn(longest) || allWordsOf(longest).areIn(shortest)) {
            let variance = (longest.wordCount - shortest.wordCount) / longest.wordCount * 100;
            let standardDeviation = Math.sqrt(variance);
            let similarity = 100 - standardDeviation;
            return similarity;
        }
        return 0;
    }







} else if (diff.inputType === "other") {
}
