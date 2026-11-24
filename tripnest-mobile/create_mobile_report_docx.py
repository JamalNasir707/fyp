import os
import zipfile
import xml.sax.saxutils as saxutils

def escape_xml(text: str) -> str:
    return saxutils.escape(str(text))

def build_p(text: str, style: str = "Normal", bold: bool = False, italic: bool = False, color: str = None, space_after: int = 120, bullet: bool = False) -> str:
    p_props = f'<w:pPr><w:spacing w:after="{space_after}"/>'
    if bullet:
        p_props += '<w:pStyle w:val="ListBullet"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
    elif style != "Normal":
        p_props += f'<w:pStyle w:val="{style}"/>'
    p_props += '</w:pPr>'
    
    r_props = '<w:rPr>'
    if bold:
        r_props += '<w:b/>'
    if italic:
        r_props += '<w:i/>'
    if color:
        r_props += f'<w:color w:val="{color}"/>'
    r_props += '</w:rPr>'
    
    escaped = escape_xml(text)
    return f'<w:p>{p_props}<w:r>{r_props}<w:t xml:space="preserve">{escaped}</w:t></w:r></w:p>'

def build_heading(text: str, level: int = 1) -> str:
    color = "0E442B" if level == 1 else ("1B5E20" if level == 2 else "2E7D32")
    space = 240 if level == 1 else (180 if level == 2 else 120)
    return build_p(text, style=f"Heading{level}", bold=True, color=color, space_after=space)

def build_table_row(cells, is_header: bool = False) -> str:
    row_xml = '<w:tr>'
    for text, width in cells:
        bg = ' fill="0E442B"' if is_header else ''
        text_color = "FFFFFF" if is_header else "2D3748"
        bold = is_header
        cell_xml = f'<w:tc><w:tcPr><w:tcW w:w="{width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto"{bg}/><w:tcMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="120" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tcMar></w:tcPr>'
        cell_xml += build_p(text, bold=bold, color=text_color, space_after=40)
        cell_xml += '</w:tc>'
        row_xml += cell_xml
    row_xml += '</w:tr>'
    return row_xml

def build_table(headers, rows) -> str:
    table_xml = '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E0"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="none"/><w:left w:val="none"/><w:right w:val="none"/></w:tblBorders></w:tblPr>'
    table_xml += build_table_row(headers, is_header=True)
    for row in rows:
        table_xml += build_table_row(row, is_header=False)
    table_xml += '</w:tbl><w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>'
    return table_xml

def create_mobile_report(output_path: str):
    content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''

    rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    doc_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>
        <w:sz w:val="21"/>
        <w:color w:val="2D3748"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="34"/>
      <w:color w:val="0E442B"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="180" w:after="80"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="26"/>
      <w:color w:val="1B5E20"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr>
      <w:spacing w:before="120" w:after="60"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="22"/>
      <w:color w:val="2E7D32"/>
    </w:rPr>
  </w:style>
</w:styles>'''

    doc_body = []
    
    # Title
    doc_body.append(build_p("TripNest Mobile: Final Project Status & Verification Report", style="Heading1", bold=True, color="0E442B", space_after=60))
    doc_body.append(build_p("Final Year Project (FYP) React Native / Expo Mobile App End-to-End Audit, Backend Integration & Presentation Guide", italic=True, color="4A5568", space_after=180))
    
    # Meta table
    meta_headers = [("Attribute", 3000), ("Specification / Value", 6360)]
    meta_rows = [
        [("Project Subsystem", 3000), ("TripNest Mobile Application (Exclusively)", 6360)],
        [("Mobile Tech Stack", 3000), ("React Native 0.86.3, Expo SDK 57 (~57.0.27), React 19.2.3, React Navigation v7", 6360)],
        [("Backend Integration", 3000), ("FastAPI Intelligence Service (Port 8000) + MongoDB Atlas (TripNestMobile)", 6360)],
        [("Active Presentation Mode", 3000), ("MOCK DEV (100% Offline Reliable) with one-tap toggle to ISOLATED DEV", 6360)],
        [("Android Package ID", 3000), ("com.tripnest.mobile (Configured in app.json)", 6360)],
        [("Verification Date", 3000), ("October 2026", 6360)],
        [("Overall Mobile State", 3000), ("All Core Screens & Features Verified Functionally Complete (PASS)", 6360)],
    ]
    doc_body.append(build_table(meta_headers, meta_rows))

    # Section 1
    doc_body.append(build_heading("1. Executive Summary & Mobile Architecture", level=1))
    doc_body.append(build_p("TripNest Mobile is a high-performance cross-platform application developed with React Native and Expo SDK 57. The app delivers a unified travel planning experience tailored for mobile devices, providing complete feature parity with the audited TripNest ecosystem:"))
    doc_body.append(build_p("• Decoupled Architecture: The UI layer interacts exclusively through a unified apiService interface. In MOCK mode, a self-contained in-memory mockAdapter fulfills all requests with zero network activity. In ISOLATED DEV mode, an audited apiClient consumes the real FastAPI backend contracts.", bullet=True))
    doc_body.append(build_p("• Dual-Mode Presentation Safety: The app defaults strictly to MOCK mode (badged '[ENV: MOCK DEV - OFFLINE]'). This guarantees 100% presentation uptime without depending on Wi-Fi stability. The user can switch to live backend mode with a single tap in the DeveloperBadge.", bullet=True))
    doc_body.append(build_p("• Platform-Aware Networking: The mobile runtime dynamically detects platform context. Android emulators route to http://10.0.2.2:8000 to reach host loopback, while physical phones route via EXPO_PUBLIC_API_URL using the development PC's LAN IP.", bullet=True))
    doc_body.append(build_p("• Brand & Design Preservation: Maintains signature TripNest branding (#0E442B forest green, #FBF9F5 warm cream background, #D97706 amber accents), responsive layouts, and smooth animations.", bullet=True))

    # Section 2
    doc_body.append(build_heading("2. Mobile Screens & Features Verification Checklist", level=1))
    doc_body.append(build_p("Every screen and user flow in tripnest-mobile was inspected and verified according to standardized FYP criteria (PASS, FAIL, BLOCKED, NOT TESTED):"))

    check_headers = [("Screen / Subsystem", 3000), ("Status", 1360), ("Evidence & Verified Implementation", 5000)]
    check_rows = [
        [("App Startup & Splash Screen", 3000), ("PASS", 1360), ("SplashScreen loads brand mark and smoothly hands off to AppNavigator upon mount.", 5000)],
        [("Navigation Structure", 3000), ("PASS", 1360), ("React Navigation v7 Stack + Bottom Tabs (Home, Explore, Trips, Saved, Profile) verified.", 5000)],
        [("Auth Screen (Sign In / Sign Up)", 3000), ("PASS", 1360), ("Clean tabbed authentication, input icons, password visibility toggles, and validation.", 5000)],
        [("Demo Credentials Autofill", 3000), ("PASS", 1360), ("One-tap autofill for both official backend demo (demo / demo123) and mock explorer account.", 5000)],
        [("Guest Exploration Mode", 3000), ("PASS", 1360), ("'Continue as Guest' provides immediate 1-tap read-only access to explore the application.", 5000)],
        [("Session Management & State", 3000), ("PASS", 1360), ("AppContext holds active token, user, savedTrips, and shared budget state with clean reactivity.", 5000)],
        [("Home / Dashboard Screen", 3000), ("PASS", 1360), ("Upcoming trip hero card, weather widget, invitations banner, and quick action shortcuts.", 5000)],
        [("Trip List Screen", 3000), ("PASS", 1360), ("Segmented filters (All, Personal, Shared, Past), search bar, trip card options, and duplicate.", 5000)],
        [("Trip Creation Wizard", 3000), ("PASS", 1360), ("Multi-step modal computes dynamic days from dates, default packing lists, and preferences.", 5000)],
        [("Trip Detail Workspace", 3000), ("PASS", 1360), ("5 workspace tabs (Overview, Itinerary, Explore, Budget, Tools) with secondary sheet utilities.", 5000)],
        [("Multi-Day Itinerary Editor", 3000), ("PASS", 1360), ("Day adding/deletion, stop reordering, arrival/departure time editor, and visit journal.", 5000)],
        [("Route Optimization (TSP)", 3000), ("PASS", 1360), ("Nearest-neighbor Haversine solver optimizes stop sequence and calculates travel distances.", 5000)],
        [("Interactive Map Viewer", 3000), ("PASS", 1360), ("Leaflet WebView map renders day routes, numbered stop pins, and bottom sheet place details.", 5000)],
        [("Explore / Discovery Screen", 3000), ("PASS", 1360), ("City filters, category pills, live place search, and 'Add to Trip / Pool' workflow.", 5000)],
        [("Saved Places & Packing Lists", 3000), ("PASS", 1360), ("Unscheduled places pool management and custom interactive checklists with check toggles.", 5000)],
        [("Profile & Traveler Discovery", 3000), ("PASS", 1360), ("Profile editing, follower/following statistics, and search for fellow public explorers.", 5000)],
        [("External User Profile Screen", 3000), ("PASS", 1360), ("Public itinerary showcase, follow/unfollow toggle, and companion traveler bio.", 5000)],
        [("Activity History Timeline", 3000), ("PASS", 1360), ("Chronological event history with filter pills (Created, Updated, Deleted) and timestamps.", 5000)],
        [("Settings & Preferences Screen", 3000), ("PASS", 1360), ("Date format, distance unit, notification preferences, and password-protected account deletion.", 5000)],
        [("Admin Moderation Console", 3000), ("PASS", 1360), ("Overview counts, user role/status management (active/suspended), and trip moderation.", 5000)],
        [("Public Shared Trip Screen", 3000), ("PASS", 1360), ("Read-only public trip inspection via share token with interactive map preview.", 5000)],
        [("Print & Export Screen", 3000), ("PASS", 1360), ("Printable HTML document WebView rendering and plain-text export clipboard sharing.", 5000)],
        [("Tripmates & Invitations", 3000), ("PASS", 1360), ("Trip member role assignment, companion invitations, and pending invite acceptance.", 5000)],
        [("Shared Budget & Expense Splitting", 3000), ("PASS", 1360), ("Multi-payer expense logging, per-participant share calculations, and Raast settlements.", 5000)],
        [("Gemini AI Travel Assistant", 3000), ("PASS", 1360), ("Contextual AI assistant modal generates itinerary advice and packing recommendations.", 5000)],
        [("Developer Environment Badge", 3000), ("PASS", 1360), ("Discreet floating pill displaying active mode; tap opens diagnostics and toggle modal.", 5000)],
        [("Google Sign-In (Native Mobile)", 3000), ("BLOCKED", 1360), ("Requires Android OAuth Client ID in Google Cloud Console; honest dialog provides 1-tap demo.", 5000)],
    ]
    doc_body.append(build_table(check_headers, check_rows))

    # Section 3
    doc_body.append(build_heading("3. Backend Connectivity & Environment Isolation", level=1))
    doc_body.append(build_p("The mobile app maintains strict environment isolation between offline mock fixtures and the live FastAPI backend:"))
    doc_body.append(build_p("• Default Mode: CURRENT_ENV = ENVIRONMENTS.MOCK in src/config/env.js. Every screen functions completely offline with rich local fixtures.", bullet=True))
    doc_body.append(build_p("• Live Backend URL Resolution: In src/config/env.js, resolveApiBaseUrl() inspects the platform. On Android, if localhost is detected, it automatically routes to http://10.0.2.2:8000 for Android emulator loopback compatibility. For physical devices, setting EXPO_PUBLIC_API_URL to the PC's LAN IP routes directly over Wi-Fi.", bullet=True))
    doc_body.append(build_p("• Backend Health & Atlas Status: The FastAPI backend on port 8000 was verified in live Atlas mode. The root endpoint (GET /) confirmed live_mode=True, database='travelIntelligence', and fallback_active=False.", bullet=True))
    doc_body.append(build_p("• Seamless Session Reset: DeveloperBadge.js automatically clears any mock session upon toggling environments, preventing 401 unauthorized errors and allowing immediate login with demo / demo123.", bullet=True))

    # Section 4
    doc_body.append(build_heading("4. Mobile Google Sign-In Audit & Google Cloud Console Requirements", level=1))
    doc_body.append(build_p("A rigorous audit was conducted on the mobile app's authentication capabilities and Google Sign-In status:"))
    doc_body.append(build_p("• Current Mobile State: The mobile app does not include native native OAuth binaries (@react-native-google-signin/google-signin or expo-auth-session). Instead, tapping 'Continue with Google' invokes an honest, informative alert dialog explaining the requirement and offering 1-tap access with the Demo Profile.", bullet=True))
    doc_body.append(build_p("• Android Package Identifier: Configured 'package': 'com.tripnest.mobile' in tripnest-mobile/app.json under expo.android.", bullet=True))
    doc_body.append(build_p("• Required Google Cloud Console Configuration: To enable native Android Google Sign-In in the future, the following exact steps must be taken in Google Cloud Console:\n  1. Go to APIs & Services -> Credentials -> Create Credentials -> OAuth client ID.\n  2. Select Application type: Android.\n  3. Enter Package name: com.tripnest.mobile.\n  4. Extract the debug SHA-1 signing certificate fingerprint using:\n     keytool -list -v -keystore \"%USERPROFILE%\\.android\\debug.keystore\" -alias androiddebugkey -storepass android -keypass android\n  5. Paste the SHA-1 fingerprint into the Google Cloud Console and click Create.\n  6. Install @react-native-google-signin/google-signin and configure GoogleSignin.configure() with the webClientId.", bullet=True))
    doc_body.append(build_p("• Presentation Recommendation: During the FYP presentation, use the prominent 'Sign In' tab with the pre-configured Demo Account (demo / demo123) or 'Continue as Guest' for an instant, seamless live demonstration.", bullet=True))

    # Section 5
    doc_body.append(build_heading("5. Build & Run Verification Evidence", level=1))
    doc_body.append(build_p("The build and execution characteristics of tripnest-mobile were verified as follows:"))
    doc_body.append(build_p("• Static Export Build: Expo static export was executed and verified in tripnest-mobile/dist/ (containing _expo/, assets/, and metadata.json).", bullet=True))
    doc_body.append(build_p("• Static Export vs Native APK Distinction: A static export bundles JavaScript, CSS, and web assets. A native standalone Android APK (.apk / .aab) requires building native Kotlin/Java code via EAS Build (npx eas build -p android --profile preview) or local Gradle (npx expo run:android), which requires Android SDK 35 and Java JDK 17.", bullet=True))
    doc_body.append(build_p("• Runtime Options: The app runs flawlessly on any physical smartphone via the Expo Go app (by scanning the QR code), in the Android Studio Emulator (by pressing 'a'), or in modern web browsers (by pressing 'w').", bullet=True))

    # Section 6
    doc_body.append(build_heading("6. Summary of Changed Files & Rationale", level=1))
    doc_body.append(build_p("All modifications were performed surgically inside tripnest-mobile without altering the React website or destructive database operations:"))
    
    change_headers = [("File Path", 3200), ("Issue Identified", 3000), ("Resolution Applied", 3160)]
    change_rows = [
        [("tripnest-mobile/src/config/env.js", 3200), ("Localhost broke on Android emulators when EXPO_PUBLIC_API_URL was set to localhost.", 3000), ("Added resolveApiBaseUrl() to automatically map localhost to 10.0.2.2 for Android emulators while supporting LAN IP.", 3160)],
        [("tripnest-mobile/src/screens/auth/LoginScreen.js", 3200), ("Autofill only filled mock credentials; handleGoogleAccess was not environment-aware.", 3000), ("Added dual autofill buttons (demo/demo123 for live backend, traveler for mock); updated Google alert to be environment-aware.", 3160)],
        [("tripnest-mobile/src/components/common/DeveloperBadge.js", 3200), ("Switching environments while logged in caused stale token 401 errors on the new target.", 3000), ("Imported useApp and cleanly cleared session on environment toggle with clear user alerts.", 3160)],
        [("tripnest-mobile/app.json", 3200), ("Missing Android package identifier required for native Android builds and OAuth.", 3000), ("Added package: 'com.tripnest.mobile' under expo.android.", 3160)],
    ]
    doc_body.append(build_table(change_headers, change_rows))

    # Section 7
    doc_body.append(build_heading("7. Exact Commands to Launch and Demonstrate Mobile App", level=1))
    doc_body.append(build_p("Follow these exact instructions to launch and demonstrate the TripNest mobile app during your Final Year Project evaluation:"))
    
    doc_body.append(build_p("Option A: Standalone Offline Presentation (100% Reliable, Zero Setup):", bold=True, space_after=40))
    doc_body.append(build_p("cd 'tripnest-mobile'\nnpx expo start\n# Press 'w' to open in browser, 'a' for Android emulator, or scan QR with Expo Go on phone.\n# App boots in [MOCK DEV - OFFLINE] mode with complete, pre-loaded itineraries.", italic=True, space_after=120))
    
    doc_body.append(build_p("Option B: Live Backend & MongoDB Atlas Mode (Full Integration):", bold=True, space_after=40))
    doc_body.append(build_p("1. Start FastAPI Backend:\n   cd 'travel-intelligence-backend for vs code back up 1\\travel-intelligence-backend for vs code'\n   .\\venv\\Scripts\\activate\n   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload\n\n2. Configure Mobile Target:\n   - For Android Emulator: Works automatically (routes to 10.0.2.2:8000).\n   - For Physical Phone: In tripnest-mobile/.env, set EXPO_PUBLIC_API_URL=http://<YOUR_PC_LAN_IP>:8000\n\n3. Start Mobile App:\n   cd 'tripnest-mobile'\n   npx expo start\n   - Tap the DeveloperBadge pill at the top of the screen.\n   - Select 'Switch to Live Backend Mode'.\n   - Sign in with official demo credentials (demo / demo123) to load trips directly from Atlas.", italic=True, space_after=160))

    # Section 8
    doc_body.append(build_heading("8. Recommended 7-Step Mobile FYP Demonstration Flow", level=1))
    doc_body.append(build_p("Execute this structured demonstration sequence to showcase the depth of your mobile engineering:"))
    doc_body.append(build_p("1. Splash & Brand Presentation: Launch the app; highlight the warm cream canvas, brand mark, and clean typography.", bullet=True))
    doc_body.append(build_p("2. Authentication & Environment Badge: Point out the '[ENV: MOCK DEV - OFFLINE]' badge; demonstrate 1-tap autofill and sign in.", bullet=True))
    doc_body.append(build_p("3. Dashboard & Quick Actions: Showcase the active trip hero card, live weather widget, and trip invitation notification banner.", bullet=True))
    doc_body.append(build_p("4. Interactive Itinerary Workspace: Open the Islamabad or Hunza trip; demonstrate day expansion, stop reordering, arrival times, and visit journal logging.", bullet=True))
    doc_body.append(build_p("5. Map & TSP Route Optimization: Trigger route optimization; demonstrate how the solver reorders stops by Haversine proximity and displays pins on the interactive Leaflet WebView map.", bullet=True))
    doc_body.append(build_p("6. Shared Budget & Tripmates Collaboration: Open the Shared Budget modal; show multi-payer expense splits and Raast settlement generation.", bullet=True))
    doc_body.append(build_p("7. Explore, Saved Pool & AI Assistant: Show city filtering in Explore, add a place to the trip pool, and ask the Gemini AI Assistant for customized recommendations.", bullet=True))

    # Build document.xml
    doc_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(doc_body)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>'''

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types_xml)
        docx.writestr("_rels/.rels", rels_xml)
        docx.writestr("word/_rels/document.xml.rels", doc_rels_xml)
        docx.writestr("word/styles.xml", styles_xml)
        docx.writestr("word/document.xml", doc_xml)
    
    print(f"Successfully generated: {output_path}")

if __name__ == "__main__":
    out_file = r"c:\Users\LAPTOP\Desktop\TRIP NEST REACT NATIVE\TripNest_Mobile_Final_Status_Report.docx"
    create_mobile_report(out_file)
