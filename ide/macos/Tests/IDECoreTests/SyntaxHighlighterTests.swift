import XCTest
@testable import IDECore

final class SyntaxHighlighterTests: XCTestCase {
    private let highlighter = SyntaxHighlighter()

    private func kinds(_ text: String) -> [(String, HighlightKind)] {
        let nsText = text as NSString
        return highlighter.highlight(text).map { span in
            (nsText.substring(with: span.range), span.kind)
        }
    }

    func testKeywordsTypesAndDeclarationNames() {
        let spans = kinds("model User {\n  id: ID\n}\n")
        XCTAssertTrue(spans.contains(where: { $0.0 == "model" && $0.1 == .keyword }))
        XCTAssertTrue(spans.contains(where: { $0.0 == "User" && $0.1 == .declarationName }))
        XCTAssertTrue(spans.contains(where: { $0.0 == "ID" && $0.1 == .typeName }))
    }

    func testStringsWithEscapesStayOneSpan() {
        let spans = kinds(#"fn f() -> String { return "a \" quote" }"#)
        XCTAssertTrue(spans.contains(where: { $0.0 == #""a \" quote""# && $0.1 == .string }))
    }

    func testLineCommentsSwallowTrailingCode() {
        let spans = kinds("let x = 1 comment: model not-a-keyword\n")
        XCTAssertTrue(spans.contains(where: { $0.0.hasPrefix("comment: model") && $0.1 == .comment }))
        XCTAssertFalse(spans.contains(where: { $0.0 == "not" }))
    }

    func testBlockCommentSpanningThreeLines() {
        let text = "let a = 1\ncomment one\ntwo\nthree end comment let b = 2\n"
        let spans = kinds(text)
        let comments = spans.filter { $0.1 == .comment }
        XCTAssertEqual(comments.count, 3) // "comment one", "two", "three end comment" scanned per line
        XCTAssertTrue(spans.contains(where: { $0.0 == "let" && $0.1 == .keyword }))
    }

    func testCommentKeywordIsNeverAnIdentifier() {
        let spans = kinds("let commenting = recommend\n")
        XCTAssertFalse(spans.contains(where: { $0.1 == .comment }))
    }

    func testStringContainingSlashesIsNotAComment() {
        let spans = kinds(#"let url = "https://example.com""#)
        XCTAssertTrue(spans.contains(where: { $0.1 == .string }))
        XCTAssertFalse(spans.contains(where: { $0.1 == .comment }))
    }

    func testRouteLinesAndNativeTargets() {
        let routeSpans = kinds("route /users/:id -> UserScreen(id: ID)\n")
        XCTAssertTrue(routeSpans.contains(where: { $0.0 == "/users/:id" && $0.1 == .routePath }))
        XCTAssertTrue(routeSpans.contains(where: { $0.0 == "route" && $0.1 == .keyword }))

        let nativeSpans = kinds("native swift fn deviceName() -> String {\n")
        XCTAssertTrue(nativeSpans.contains(where: { $0.0 == "swift" && $0.1 == .nativeTarget }))
        XCTAssertTrue(nativeSpans.contains(where: { $0.0 == "native" && $0.1 == .keyword }))
    }
}
