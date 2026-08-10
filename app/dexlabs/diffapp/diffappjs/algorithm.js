if (diff.inputType === "plain text") {
    // Let old text be `o` and new text be `n`
    // There are three levels of comparison: interline, word, and character.
    // Define an "anchor" as a group of similar words that appear in the same line of `o` and `n`.
    // Example:
    // Old: "I'm a disco dancer in the night club of California."
    // New: "In the night club of Mexico, there was a fire accident."
    // Here the anchor is "in the night club" – a group of similar words appearing in both lines.

    // Similarity function for two lines:
    function similarity(lineA, lineB) {
        // Determine which line has more words (longest) and which has fewer (shortest)
        let longest = lineA.wordCount >= lineB.wordCount ? lineA : lineB;
        let shortest = lineA.wordCount < lineB.wordCount ? lineA : lineB;
        // Check if all words of the shortest line appear in the longest line (or vice versa)
        if (allWordsOf(shortest).areIn(longest) || allWordsOf(longest).areIn(shortest)) {
            let variance = (longest.wordCount - shortest.wordCount) / longest.wordCount * 100;
            let standardDeviation = Math.sqrt(variance);
            let similarity = 100 - standardDeviation;
            return similarity;
        }
        // Otherwise, return 0 or some default low similarity
        return 0;
    }

    // ---- INTERLINE LEVEL ----
    // For each line in `o` and `n`:
    // - If the lines are ≥80% similar, proceed to word‑ and character‑level diff using anchor positions.
    // - If they are <80% similar, compare that line from `o` with every line in `n` to find the first line that matches with ≥80% similarity.
    //   Once found, shift the corresponding block of lines in `o` to align with that line in `n`.
    //   For example, if line 2 of `o` matches line 27 of `n` with >80% similarity, reposition lines 2..N of `o` to lines 27..N+25 of `n`
    //   (i.e., insert blank lines as needed) so that intra‑line comparison can be performed.
    // - If no matching line is found (i.e., all comparisons yield <80% similarity), fall back to word‑ and character‑level diff using anchors.

    // This is a two‑way comparison: not only do we compare old lines against new, but also new lines against old.
    // Example:
    // Old:
    //   "good day, mate."
    //   "how are you?"
    // New:
    //   "how are you, dude?"
    //   "hope you are doing good"
    // First, compare line 1 of old with line 1 of new – they are not similar.
    // Then compare line 1 of old with line 2 of new – still not similar.
    // Next, compare line 1 of new with line 2 of old – "how are you, dude?" is >80% similar to "how are you?".
    // Therefore, shift lines so that in the new text line 1 is considered a blank insertion,
    // line 2 aligns with the old line 2, and line 3 follows.

    // After completing all interline alignments, we proceed to the word‑level diff.

    // ---- WORD LEVEL ----
    // Use anchors (groups of similar words) within each aligned line.
    // A line may contain multiple anchors.
    // Compare words based on these anchors to identify insertions, deletions, or changes.

    // ---- CHARACTER LEVEL ----
    // After word‑level processing, apply the existing character‑level diff algorithm to the remaining differences within words.

    // ---- TRIM WHITESPACE OPTION ----
    // Provide a checkbox: "Trim whitespace". When checked, all comparisons must ignore extra spaces.
    // Text should be normalized as if there is only a single space between words, and no leading/trailing spaces.
    // For example:
    //   "    what are    you doing mate"
    //   "what are you doing mate"
    // These two should be considered identical, and no differences should be shown.

} else if (diff.inputType === "other") {
    // Use the current line‑by‑line algorithm.
}
