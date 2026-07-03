import XCTest
@testable import IDECore

final class SemanticTokenDecoderTests: XCTestCase {
    func testDecodesHandComputedDeltaExample() {
        // line 0: 'module' char 0 len 6, keyword (index 9)
        // line 2: 'model'  char 0 len 5, keyword
        // line 2: 'Greeting' char 6 len 8, model (index 14), declaration (bit 0)
        let data = [
            0, 0, 6, 9, 0,
            2, 0, 5, 9, 0,
            0, 6, 8, 14, 1,
        ]

        let spans = SemanticTokenDecoder.decode(data)

        XCTAssertEqual(spans.count, 3)
        XCTAssertEqual(spans[0], TokenSpan(line: 0, startCharacter: 0, length: 6, typeName: "keyword", modifiers: []))
        XCTAssertEqual(spans[1].line, 2)
        XCTAssertEqual(spans[1].startCharacter, 0)
        XCTAssertEqual(spans[2].line, 2)
        XCTAssertEqual(spans[2].startCharacter, 6)
        XCTAssertEqual(spans[2].typeName, "model")
        XCTAssertEqual(spans[2].modifiers, ["declaration"])
    }

    func testEmptyDataDecodesToNothing() {
        XCTAssertTrue(SemanticTokenDecoder.decode([]).isEmpty)
    }

    func testLegendMatchesDocs21Order() {
        XCTAssertEqual(SemanticTokenDecoder.tokenTypes.count, 21)
        XCTAssertEqual(SemanticTokenDecoder.tokenTypes[9], "keyword")
        XCTAssertEqual(SemanticTokenDecoder.tokenTypes[14], "model")
        XCTAssertEqual(SemanticTokenDecoder.tokenTypes[20], "nativeTarget")
    }
}
