import Foundation
import Testing
@testable import PkmnLifeRemoteKit

private func screen(_ x: CGFloat, _ width: CGFloat, _ height: CGFloat, menuBar: CGFloat = 0) -> ScreenInfo {
    let frame = CGRect(x: x, y: 0, width: width, height: height)
    return ScreenInfo(frame: frame, visibleFrame: CGRect(x: x, y: 0, width: width, height: height - menuBar))
}

@Suite struct ScreenLayoutTests {
    @Test func ultrawide() {
        #expect(ScreenLayout.isUltrawide(screen(0, 3440, 1440)))
        #expect(ScreenLayout.isUltrawide(screen(0, 2560, 1080)))
        #expect(ScreenLayout.isUltrawide(screen(0, 5120, 1440)))
        #expect(ScreenLayout.isUltrawide(screen(0, 3008, 1692)))
        #expect(!ScreenLayout.isUltrawide(screen(0, 1512, 982)))
        #expect(!ScreenLayout.isUltrawide(screen(0, 2560, 1440)))
        #expect(!ScreenLayout.isUltrawide(screen(0, 1440, 2560)))
    }

    @Test func automaticShowsOnTheUltrawide() throws {
        let laptop = screen(0, 1512, 982)
        let wide = screen(1512, 3440, 1440)
        let choice = try #require(ScreenLayout.choose(screens: [laptop, wide], mode: .automatic))
        #expect(choice.screen == wide)
        #expect(choice.shown)
    }

    @Test func automaticTucksWithoutOne() throws {
        let laptop = screen(0, 1512, 982)
        let choice = try #require(ScreenLayout.choose(screens: [laptop, screen(1512, 2560, 1440)], mode: .automatic))
        #expect(choice.screen == laptop)
        #expect(!choice.shown)
    }

    @Test func modesOverride() throws {
        let laptop = screen(0, 1512, 982)
        #expect(try #require(ScreenLayout.choose(screens: [laptop], mode: .alwaysShown)).shown)
        #expect(try #require(ScreenLayout.choose(screens: [laptop, screen(1512, 3440, 1440)], mode: .tucked)).shown == false)
        #expect(ScreenLayout.choose(screens: [], mode: .automatic) == nil)
    }

    @Test func frames() {
        let s = screen(1512, 3440, 1440, menuBar: 33)
        let size = CGSize(width: 320, height: 300)
        #expect(ScreenLayout.openFrame(size: size, on: s) == CGRect(x: 1512 + 3440 - 320, y: 1407 - 300, width: 320, height: 300))
        #expect(ScreenLayout.tuckedFrame(size: size, on: s, peek: 42) == CGRect(x: 1512 + 3440 - 42, y: 1407 - 300, width: 42, height: 300))
    }
}

@Suite struct RemoteRequestTests {
    @Test func text() {
        let date = Date(timeIntervalSince1970: 1_793_000_000.25)
        #expect(RemoteRequest.text("play alex random", at: date) == "1793000000250 1793000000 play alex random")
    }

    @Test func applyKeepsTheRest() throws {
        let doc: [String: JSONValue] = ["version": .int(5), "values": .object(["sprint_display": .string("short"), "clock_animation": .string("majora")])]
        let out = try #require(RemoteRequest.apply("stop", at: Date(timeIntervalSince1970: 10), to: doc))
        #expect(out["version"] == .int(5))
        #expect(out["values"] == .object(["sprint_display": .string("short"), "clock_animation": .string("majora"), "remote": .string("10000 10 stop")]))
    }

    @Test func applyRespectsMacRemoteOff() {
        let doc: [String: JSONValue] = ["values": .object(["remote_control": .bool(false)])]
        #expect(RemoteRequest.apply("card", at: .now, to: doc) == nil)
    }
}

@Suite struct JSONValueTests {
    @Test func roundTripKeepsTypes() throws {
        let json = #"{"version":5,"values":{"on":true,"n":1,"x":1.5,"s":"09:00","none":null,"list":[0,false]}}"#
        let doc = try JSONDecoder().decode([String: JSONValue].self, from: Data(json.utf8))
        #expect(doc["version"] == .int(5))
        #expect(doc["values"] == .object([
            "on": .bool(true), "n": .int(1), "x": .double(1.5), "s": .string("09:00"), "none": .null,
            "list": .array([.int(0), .bool(false)]),
        ]))
        let again = try JSONDecoder().decode([String: JSONValue].self, from: JSONEncoder().encode(doc))
        #expect(again == doc)
    }
}

@Suite struct BarClientTests {
    @Test func urls() throws {
        let client = BarClient(host: " 192.168.1.42:8080 ", token: nil)
        #expect(try client.url("apps/settings", query: [URLQueryItem(name: "app_id", value: Catalog.appID)]).absoluteString
            == "http://192.168.1.42:8080/api/apps/settings?app_id=app.vlad.pkmn_life")
        #expect(throws: BarError.self) { try BarClient(host: "", token: nil).url("version") }
    }

    @Test func statuses() {
        #expect(BarError.status(200) == nil)
        #expect(BarError.status(404) == BarError("Pkmn Life isn't installed on the bar."))
        #expect(BarError.status(500)?.message == "The bar answered with an error (500).")
    }
}

@Suite struct BarConnectionTests {
    @Test func hosts() {
        #expect(BarConnection.simulator.host(custom: "192.168.1.42") == "127.0.0.1:2879")
        #expect(BarConnection.usb.host(custom: "192.168.1.42") == "10.0.4.20")
        #expect(BarConnection.ip.host(custom: " 192.168.1.42:80 ") == "192.168.1.42:80")
    }

    @Test func savedBeforeThereWasAChoice() {
        #expect(BarConnection.saved(nil, host: nil) == .usb)
        #expect(BarConnection.saved(nil, host: "10.0.4.20") == .usb)
        #expect(BarConnection.saved(nil, host: "192.168.1.42") == .ip)
        #expect(BarConnection.saved(nil, host: "127.0.0.1:2879") == .simulator)
        #expect(BarConnection.saved("simulator", host: "192.168.1.42") == .simulator)
        #expect(BarConnection.saved("nonsense", host: nil) == .usb)
    }
}

@Suite struct PkmnSettingsTests {
    @Test func valuesFallBackToDefaults() {
        let doc: [String: JSONValue] = ["values": .object([
            "sprint_display": .string("dots"), "show_date": .string("yes"), "dawn_time": .string("25:00"), "remote": .string("1 1 stop"),
        ])]
        let values = PkmnSettings.values(in: doc)
        #expect(values["sprint_display"] == .string("dots"))
        #expect(values["show_date"] == .bool(true))
        #expect(values["dawn_time"] == .string("09:00"))
        #expect(values["remote"] == nil)
        #expect(values.count == PkmnSettings.fields.count)
    }

    @Test func mergeKeepsTheRequestAndUnknownValues() {
        let doc: [String: JSONValue] = ["version": .int(5), "values": .object(["remote": .string("1 1 stop"), "future": .int(3)])]
        let out = PkmnSettings.merge(["sprint_display": .string("bar"), "remote": .string("")], into: doc)
        #expect(out == ["version": .int(5), "values": .object(["remote": .string("1 1 stop"), "future": .int(3), "sprint_display": .string("bar")])])
    }

    @Test func times() {
        #expect(PkmnSettings.minutes("09:05") == 545)
        #expect(PkmnSettings.minutes("9:5") == 545)
        #expect(PkmnSettings.minutes("24:00") == nil)
        #expect(PkmnSettings.minutes("noon") == nil)
        #expect(PkmnSettings.timeText(minutes: 545) == "09:05")
    }
}

/// The Mac app mirrors Pkmn Life's settings and entries; these check the mirror against the bar app's own files.
@Suite struct MatchesTheBarApp {
    private static let repo = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent().deletingLastPathComponent()
    private static let app = repo.appending(path: "apps/pkmn-life/src")

    @Test func simulatorPortMatchesItsServer() throws {
        let serve = try String(contentsOf: Self.repo.appending(path: "packages/sim/scripts/serve.ts"), encoding: .utf8)
        let port = try #require(BarConnection.simulatorHost.split(separator: ":").last)
        #expect(serve.contains("export const DEFAULT_PORT = \(port);"))
    }

    @Test func settingsMatchSettingsJSON() throws {
        let data = try Data(contentsOf: Self.app.appending(path: "appmeta/settings.json"))
        let schema = try JSONDecoder().decode([String: JSONValue].self, from: data)
        guard case .object(let declared)? = schema["fields"] else {
            Issue.record("settings.json has no fields")
            return
        }
        #expect(Set(declared.keys) == Set(PkmnSettings.fields.map(\.id)).union(PkmnSettings.internalFields))
        for field in PkmnSettings.fields {
            guard case .object(let d)? = declared[field.id] else {
                Issue.record("\(field.id) is not in settings.json")
                continue
            }
            #expect(d["label"] == .string(field.label), "\(field.id) label")
            #expect(d["default"] == field.defaultValue, "\(field.id) default")
            switch field.kind {
            case .choice(let options):
                #expect(d["type"] == .string("enum"), "\(field.id) type")
                let expected = options.map { JSONValue.object(["value": .string($0.value), "label": .string($0.label)]) }
                #expect(d["options"] == .array(expected), "\(field.id) options")
            case .toggle:
                #expect(d["type"] == .string("boolean"), "\(field.id) type")
            case .time:
                #expect(d["type"] == .string("time"), "\(field.id) type")
            case .text(let maxLength):
                #expect(d["type"] == .string("string"), "\(field.id) type")
                #expect(d["max_length"] == .int(maxLength), "\(field.id) max_length")
            }
        }
    }

    @Test func catalogMatchesPresets() throws {
        let presets = try String(contentsOf: Self.app.appending(path: "presets.ts"), encoding: .utf8)
        func list(_ name: String) -> [String] {
            guard let line = presets.split(separator: "\n").first(where: { $0.contains("const \(name) = [") }) else { return [] }
            return line.split(separator: "\"").enumerated().filter { $0.offset % 2 == 1 }.map { String($0.element) }
        }
        #expect(list("NAG_STYLES") == Catalog.nagStyles.map(\.id))
        #expect(list("REDIRECT_STYLES") == Catalog.redirectStyles.map(\.id))
        // The ticket is the only entry presets.ts names; the people come from redirects.json.
        let ids = presets.split(separator: "\n").filter { $0.contains("{ kind: ") }.compactMap { line -> String? in
            guard let r = line.range(of: "id: \"") else { return nil }
            return String(line[r.upperBound...].prefix { $0 != "\"" })
        }
        #expect(ids == [Catalog.ticket.id])
    }

    @Test func exampleRedirectsParse() throws {
        let data = try Data(contentsOf: Self.app.deletingLastPathComponent().appending(path: "redirects.example.json"))
        let list = try JSONDecoder().decode([String].self, from: data)
        let people = list.compactMap(Person.init)
        #expect(people.count == list.count)
        #expect(people.map(\.text) == list)
    }
}

@Suite struct PeopleTests {
    @Test func parse() {
        #expect(Person("< Sam") == Person(name: "Sam", side: .left))
        #expect(Person("  Alex >") == Person(name: "Alex", side: .right))
        #expect(Person("Sam") == nil)
        #expect(Person("< Sam >") == nil)
        #expect(Person("<") == nil)
        #expect(Person.list("< Sam, Alex >\n< Jo") == [Person(name: "Sam", side: .left), Person(name: "Alex", side: .right), Person(name: "Jo", side: .left)])
        #expect(Person.list("< Sam, Alex") == nil)
        #expect(Person.list(" ") == [])
        #expect(Person.text([Person(name: "Sam", side: .left), Person(name: "Alex", side: .right)]) == "< Sam, Alex >")
    }

    /// The same rule as apps/pkmn-life/assets/redirects.ts: lower case, letters and digits only.
    @Test func ids() {
        #expect(Person(name: "Jo Ann", side: .left).id == "joann")
        #expect(Person(name: "O'Neil-2", side: .right).id == "oneil2")
    }

    @Test func rowGoesLeftTicketRight() {
        let people = Person.list("Alex >, < Sam, Mo >, < Jo")!
        #expect(Catalog.row(people).map(\.id) == ["sam", "jo", "ticket", "alex", "mo"])
        #expect(Catalog.entries(people).map(\.id) == ["ticket", "alex", "sam", "mo", "jo"])
        #expect(Catalog.redirect(to: people[1]).kind == .redirect(.left))
    }
}
