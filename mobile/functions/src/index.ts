import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import * as crypto from "crypto";

initializeApp();

// ── Garage Scholars Mobile App functions ──
export {
  gsOnJobUpdated,
  gsOnTransferCreated,
  gsOnRescheduleUpdated,
  gsLockScores,
  gsExpireTransfers,
  gsResetViewerCounts,
  gsMonthlyGoalReset,
  gsComputeAnalytics,
  gsSubmitComplaint,
  gsSendPush,
} from "./gs-functions";

// ── Garage Scholars Payment functions ──
export {
  gsReleaseCompletionPayouts,
  gsCreateStripeAccount,
  gsStripeWebhook,
  gsCreateCustomerPayment,
  gsCreateRetentionSubscription,
  gsResalePayout,
  gsMarkPayoutPaid,
  gsGeneratePaymentReport,
  gsExportPaymentData,
} from "./gs-payments";

const db = getFirestore();
const storage = getStorage();
const adminAuth = getAuth();

// Admin emails that have elevated privileges
const ADMIN_EMAILS = [
  'tylerzsodia@gmail.com',
  'zach.harmon25@gmail.com'
];

// ── Package tier descriptions for SOP prompt ──
const PACKAGE_DATA: { [key: string]: string } = {
  undergraduate: "The Undergrad ($1,197) — Surface Reset & De-Clutter. 2 Scholars, 4-5 hours. Up to 1 truck bed haul-away included. Broad sorting (Keep/Donate/Trash). 1 zone / 1 shelf included. Sweep & blow clean. Standard Clean guarantee.",
  graduate: "The Graduate ($2,197) — Full Organization Logic & Install. 2 Scholars, 6-8 hours. Up to 1 truck bed haul-away included. Micro-sorting (Sports/Tools/Holiday). $300 credit towards storage & shelving (Bold Series catalog). 8 standard bins included. Deep degrease & wipe down / floor powerwash. 30-Day Clutter-Free Guarantee.",
  doctorate: "The Doctorate ($3,797) — White-Glove Detail. 3 Scholars, 1 full day. Up to 2 truck bed haul-away included. $500 credit towards storage & shelving (Bold Series catalog). 16 premium bins included. Deep degrease & wipe down / floor powerwash. Seasonal swap (1 return visit included). Heavy-duty surcharge waived."
};

const SOP_SYSTEM_PROMPT = `You are writing Standard Operating Procedures for Garage Scholars — a Denver garage transformation company that hires college students (undergrad and grad) as crew members ("scholars"). These students have ZERO construction or trade experience. They may have never used a drill, stud finder, or power washer before.

YOUR #1 RULE: Write every instruction as if the reader has never done this before. Never assume they know how to do anything. If a step involves a tool, tell them exactly how to use that tool. If a step involves a measurement, tell them exactly where to measure from and how to mark it.

SOPs must be:
- Written in plain language a college freshman can follow without Googling anything
- Broken into tiny sub-steps — if you can split a step further, split it
- Specific about WHICH tool, WHICH bolt, WHICH setting, WHERE to stand
- Grounded in what you can see in the intake photos
- Include time estimates for every phase so scholars can pace themselves
- Include "STOP AND CHECK" moments before irreversible steps (drilling, cutting, bolting)

TONE: Direct, friendly, confident. Like a patient older coworker showing you the ropes on your first day. Never condescending, but never assume knowledge.

CRITICAL image analysis rules:
- Describe spatial zones (left wall, back corner, center floor) not item inventories
- Use condition language: "moderate clutter", "clear wall space", "items stacked to approximately 4 feet"
- Never count or name specific items you see in photos
- If something is unclear in a photo, write "assess on arrival" — never guess

═══════════════════════════════════════
  TOOL & EQUIPMENT HOW-TO GUIDE
═══════════════════════════════════════

HOW TO USE A STUD FINDER:
1. Place the stud finder flat against the wall, away from where you think a stud might be
2. Press and hold the power button — wait for it to calibrate (light goes green or it beeps once)
3. Slowly slide it horizontally across the wall — move it about 1 inch per second
4. When it beeps/lights up, that's the EDGE of a stud — mark it with a pencil
5. Keep sliding — when it beeps/lights again, that's the OTHER edge of the stud
6. The CENTER of the stud is halfway between your two pencil marks — mark it with an X
7. Studs are usually 16 inches apart — measure 16" from your first stud to find the next one, then confirm with the stud finder
8. ALWAYS verify with the stud finder, never just assume 16" spacing

HOW TO USE THE DRILL:
1. To insert a drill bit: open the chuck by rotating it counter-clockwise (righty-tighty, lefty-loosey), insert the bit, tighten by hand, then give it a short squeeze on the trigger to fully seat it
2. For PRE-DRILLING (making pilot holes): use the smaller gold-colored drill bit, set the drill to the drill icon (not the screw icon), push firmly into your pencil mark, drill until the bit is about 2" deep, pull straight back out
3. For DRIVING SCREWS/BOLTS: switch to the screw/bolt socket bit, set drill to the screw icon, place the bolt in the hole, push firmly and squeeze the trigger slowly — if it slips, push harder and go slower
4. CLOCKWISE = tighten (drive in). COUNTER-CLOCKWISE = loosen (back out). There's a switch near the trigger to change direction
5. If the drill smells hot or starts smoking, STOP — let it cool for 5 minutes
6. When driving lag bolts into studs, you will feel strong resistance — this is normal and means you hit wood. If it goes in too easily with no resistance, you missed the stud — STOP, back it out, re-check stud location

HOW TO USE A LEVEL:
1. Place the level on the surface you're checking (on top of a shelf, against a cabinet, etc.)
2. Look at the bubble vial in the center — it's a small glass tube with liquid and an air bubble
3. If the bubble is exactly between the two lines, the surface is LEVEL (perfectly flat/horizontal)
4. If the bubble drifts left, the left side is too high — raise the right side or lower the left
5. For vertical checks (plumb), use the vial on the end of the level — same concept, bubble between lines = perfectly vertical
6. ALWAYS check level front-to-back AND left-to-right before tightening anything permanently

HOW TO USE THE POWER WASHER:
1. Connect the garden hose to the water inlet (hand-tighten, no wrench needed), turn on the water fully
2. Connect the high-pressure hose to the wand and to the pump
3. Squeeze the trigger to bleed air out of the line — water should flow from the nozzle
4. Plug in / start the engine — now when you squeeze the trigger, it sprays at high pressure
5. Stand 2-3 feet back from the surface. Hold the wand with BOTH hands. Sweep side to side in even passes, overlapping each pass by a few inches
6. NEVER point at people, pets, windows, or electrical outlets
7. NEVER use on drywall or painted interior walls — concrete floors and bare walls only
8. When done: turn off the machine FIRST, then release remaining pressure by squeezing the trigger, then turn off the water

HOW TO USE THE LABEL MAKER:
1. Turn it on, type the label text (keep it short: "SPORTS", "HOLIDAY", "AUTO", "TOOLS", etc.)
2. Hit print, peel the backing off, stick it on the front-center of the bin
3. Press firmly and smooth out bubbles
4. Make labels ALL CAPS for readability

MEASURING & MARKING:
1. Hook the tape measure tab over the edge of what you're measuring, or press it flat against the wall
2. Pull the tape straight — don't let it sag or curve
3. Read the measurement at the large numbered marks (feet) and small marks (inches). Each small mark = 1/16", but you only need to be accurate to the nearest 1/4"
4. Mark with a pencil — make a small V shape (caret) pointing at your exact measurement, not a dot
5. When marking a level line across a wall: mark both ends, then use the level as a straight edge to connect them with a pencil line

═══════════════════════════════════════
  GARAGE & PRODUCT REFERENCE
═══════════════════════════════════════

STANDARD RESIDENTIAL GARAGE SIZES (Denver Metro):
- 1-car: ~12ft wide x 20ft deep, 8-9ft ceiling
- 2-car: ~20ft wide x 20ft deep, 8-9ft ceiling (MOST COMMON in Denver)
- 3-car: ~30ft wide x 20ft deep, 8-10ft ceiling
- Wall studs are hidden behind drywall, spaced 16" apart (use stud finder to locate)
- Ceiling joists: also hidden, spaced 16" or 24" apart
- Garage door opening: 7ft tall standard, 8ft for oversized

STANDARD TRUCK LOADOUT — WHAT TO BRING:
All jobs:
- Brooms (push broom + angle broom), dustpans, leaf blower, shop vac
- Degreaser spray bottles (2), rags, trash bags (33-gallon AND contractor-grade black bags)
- PPE kit: work gloves for each scholar, safety glasses for each scholar, dust masks
- Moving equipment: furniture dolly, hand truck
- Tool kit: cordless drill + charger + 2 batteries, level (2ft minimum), stud finder, tape measure (25ft), pencil, socket set, Phillips and flathead bits, 5/16" and 3/8" socket bits

Graduate and above — add:
- Power washer + garden hose connector
- 8 clear storage bins (60qt each)
- Label maker + extra tape cartridge
- Zip ties (bag of 100, various sizes)
- Furniture pads (moving blankets)

Doctorate — add:
- 16 premium storage bins total
- Extra contractor bags (box of 20)
- Seasonal storage labels (pre-printed)
- Printed label sheets for custom bin labels
- Extra furniture pads

BOLD SERIES CABINET INSTALLATION (step by step):
Wall Cabinets:
1. Find the studs on the wall where cabinets will go (see HOW TO USE A STUD FINDER above). Mark each stud center with a vertical pencil line
2. Measure 54 inches up from the floor and make a pencil mark on each stud line — this is the BOTTOM of the wall cabinet
3. Use the level to draw a horizontal line connecting all your marks — this is your mounting line
4. STOP AND CHECK: Is the line level? Are you on at least 2 studs? If the answer to either is no, re-measure
5. Hold the cabinet up to the line (TWO people — one holds, one marks). Mark through the cabinet's mounting holes onto the wall
6. Set the cabinet down. Pre-drill pilot holes at each mark using the smaller drill bit — drill about 2.5" deep
7. Hold the cabinet back up to the line. Thread a 5/16" x 3" lag bolt through each mounting hole. Drive them in with the drill socket bit — tighten until snug but don't overtighten (cabinet should not flex)
8. Check level again. If not level, loosen slightly and adjust. MINIMUM 2 lag bolts into 2 different studs per cabinet

Floor Cabinets:
1. Slide the cabinet into position against the wall
2. Place the level on top — check left-right AND front-back
3. If not level: slide plastic or wooden shims under the low side until the bubble is centered. Concrete floors are almost never perfectly flat, so shimming is normal
4. If the cabinet set came with connection bolts, align the pre-drilled holes on adjacent cabinets and bolt them together
5. Optional but recommended: drive a 1/4" lag bolt through the cabinet's back panel into a wall stud to prevent tipping

Worktops (Bamboo or Stainless):
1. ALL cabinets must be installed, leveled, and connected FIRST
2. Lift the worktop and place it on the cabinet frames — it should sit flat and not wobble
3. Look underneath: find the included clips. Attach each clip to the underside of the top and screw into the cabinet frame
4. The top should not slide when you push on it — if it moves, add more clips

OVERHEAD RACK INSTALLATION (step by step):
1. CHECK FIRST: Measure ceiling height with tape measure. Need at least 8ft for 32"-deep racks, at least 9ft for 48"-deep racks. If ceiling is too low, DO NOT install — call admin
2. Decide where the rack will go. It should NOT be directly above where a car parks (door swing clearance). Usually goes toward the back or sides
3. Use stud finder on the CEILING to find joists. Mark the joist centers. Joists run in one direction — once you find one, the next is usually 16" or 24" away in the same direction
4. Hold up the rack's mounting brackets and mark the 4 bolt holes on the ceiling, making sure EACH hole lines up with a joist. NEVER bolt into just drywall — the rack will fall
5. STOP AND CHECK: Are all 4 marks on joists? Use the stud finder to re-verify each mark. This is a 600-lb-rated rack hanging over people's heads — this step is not optional
6. Pre-drill pilot holes at all 4 marks using the smaller drill bit — drill about 2.5" deep into the joist
7. TWO-PERSON JOB: One person holds the bracket in place, the other drives the 3/8" x 3" lag bolts in with the drill socket. You will feel strong resistance — that's good, it means you're in the wood
8. Repeat for all 4 mounting points
9. Hang the rack frame from the mounted brackets, secure with included pins or bolts
10. Test: hang on it briefly (one person). If it holds your body weight, it's solid. If it flexes, creaks, or moves, STOP — something is wrong, re-check all bolts
11. Minimum 7ft clearance below the rack so car doors can open underneath

STANDARD SHELVING INSTALLATION (step by step):
1. Unbox all pieces. Lay them out and match them to the instruction sheet. Don't throw away any hardware bags yet
2. Follow the included instructions to assemble the upright shelf frame — it's usually just hammering shelf clips into the vertical posts and dropping the shelf panels in
3. Stand the shelf upright in its final position against the wall
4. Place the level on the top shelf — adjust the feet (twist them like screws) until level in both directions
5. ANTI-TIP BRACKET (REQUIRED — non-negotiable): Find the L-shaped metal bracket included in the box. Hold it against the wall behind the shelf, high up. Mark the screw hole on the wall
6. Use stud finder to check if your mark is on a stud. If yes: pre-drill and drive a 1/4" lag bolt through the bracket into the stud. If no: move the bracket left or right until it IS on a stud
7. Attach the other end of the bracket to the shelf frame with the included screw
8. Test: push the top of the shelf forward — it should NOT tip. If it flexes more than an inch, the bracket isn't secured properly

CLICK-IN PLATE FLOORING:
1. The entire garage floor must be swept, degreased, and COMPLETELY DRY before starting — any moisture will trap under the tiles
2. Start at the BACK WALL of the garage, in the corner furthest from the garage door
3. Leave a 1/4" gap between the first tile and the wall (use a shim or folded cardboard as a spacer) — this is an expansion gap so the tiles don't buckle
4. Lay the first tile down. Pick up the second tile and angle the interlocking edge into the first tile's edge, then press down flat — you should hear/feel it click
5. Use a rubber mallet to tap tiles firmly together if they don't fully click — tap on the edge, not the center
6. Work in rows from back to front, left to right
7. At the end of each row, you'll need to cut a tile to fit. Measure the remaining space, subtract 1/4" for the expansion gap, and mark the tile. Cut with a utility knife (score deeply and snap) or jigsaw
8. Continue until the entire floor is covered. The last row (at the garage door) also gets a 1/4" expansion gap
9. Walk the entire floor when done — press down any tiles that feel loose or high

═══════════════════════════════════════
  PHASE PATTERNS BY PACKAGE TIER
═══════════════════════════════════════

UNDERGRADUATE — Surface Reset (2 scholars, 4-5 hours):
1. Setup & Safety (15 min)
   a. Both scholars put on gloves, safety glasses, dust masks
   b. Ask client to move vehicles out of the garage to the street
   c. Take BEFORE photos: stand at the garage door opening and photograph the entire space. Then photograph each wall straight-on. Minimum 4 photos
   d. Open the app and check in at the job
2. Broad Sorting — The Pull-Out (90-120 min)
   a. Set up 3 zones on the driveway with contractor bags or tarps: KEEP (left), DONATE (center), TRASH (right)
   b. Start at the back of the garage and work forward. Pull EVERYTHING out — leave nothing inside
   c. As you pull each item out, ask the client: "Keep, donate, or trash?" Place it in the right zone. If client isn't available, use your judgment and put questionable items in KEEP
   d. HAZMAT RULE: If you see paint cans, propane tanks, car batteries, or chemical containers — set them aside in a separate area. Do NOT put them in any zone yet. Flag for admin
   e. Heavy items (50+ lbs): BOTH scholars lift together. Bend at the knees, not the back. Use the dolly or hand truck for anything on wheels or with a flat bottom
3. Sweep & Blow Clean (30 min)
   a. Push broom the entire floor from back to front
   b. Use the leaf blower to blow dust and debris out the garage door (warn the client first if their car is nearby)
   c. Shop vac the corners, edges along walls, and any cracks in the concrete
   d. The floor should be visibly clean — no dust bunnies, no debris in corners
4. Install Single Shelf Unit (30 min)
   a. Follow STANDARD SHELVING INSTALLATION steps above
   b. Position the shelf on the wall the client prefers (or the longest open wall if no preference)
   c. DO NOT skip the anti-tip bracket
5. Organized Reload (60 min)
   a. Carry KEEP items back in. Group similar items together: sports stuff together, tools together, holiday together, auto stuff together
   b. Heavy items go on lower shelves. Light items go on top shelves
   c. Frequently used items go in the most accessible spots (near the door to the house or the garage door opening)
   d. Lean tall items (rakes, shovels, ladders) against the wall near the shelf
6. Haul-Away Loading (30 min)
   a. Load TRASH items into the truck first — heavy stuff on the bottom, bags on top
   b. Load DONATE items separately (they go to a different location)
   c. Double-check with the client: "Is there anything in the donate or trash pile you want to keep?" — do this BEFORE it goes in the truck
   d. Sweep the driveway where the sort zones were
7. Client Walkthrough & Photos (15 min)
   a. Walk the client through the garage. Show them where things are organized
   b. Take AFTER photos from the same angles as the BEFORE photos
   c. Ask: "Is there anything you'd like us to adjust?"
   d. Thank the client. Ask if they'd leave a Google review (don't be pushy, just ask once)
   e. Check out on the app

GRADUATE — Full Organization (2 scholars, 6-8 hours):
1. Setup & Safety (15 min)
   a. Both scholars: gloves, safety glasses, dust masks on
   b. Ask client to move vehicles out
   c. Take BEFORE photos: minimum 6 angles — all 4 walls, ceiling, and floor close-up. These are for the client's before/after comparison
   d. Check in on the app
2. Full Pull-Out & Micro-Sort (60-90 min)
   a. Set up 5 ZONES on the driveway. Use painter's tape labels or cardboard signs: SPORTS | TOOLS | HOLIDAY/SEASONAL | AUTO/OUTDOOR | TRASH/DONATE
   b. Pull everything out of the garage. Sort into the 5 zones as you go
   c. Items that don't fit a zone go into a "MISC" area — you'll deal with them during reload
   d. Keep a mental note of items with resale value (nice furniture, name-brand equipment, power tools in good condition) — note them in the app for admin
   e. HAZMAT RULE: paint, propane, batteries, chemicals → separate pile. Flag for admin. Do NOT load in truck
   f. Heavy lift rule: 50+ lbs = both scholars lift together. Use dolly for anything with a flat bottom
3. Deep Clean (30-45 min)
   a. Degrease: spray degreaser on oil stains and dirty wall areas. Let it sit 5 minutes
   b. Scrub stubborn spots with a stiff brush
   c. Power wash the floor (see HOW TO USE POWER WASHER above). Start at the back, sweep toward the garage door opening
   d. Let the floor dry — this takes 15-30 min depending on airflow. You can work on installs during dry time if the install area is dry
4. Install Storage Systems (60-120 min)
   a. Refer to the INSTALLATION SPECIFICATIONS section for this specific job
   b. GENERAL ORDER: Wall-mounted items first (cabinets, overhead), then floor items (shelving, floor cabinets)
   c. Reason: if you install floor items first, they'll be in your way when you're trying to drill into the wall above them
   d. Take your time. Measure twice, drill once. If unsure, ask your partner to double-check before you drill
5. Organized Reload with Bins (60-90 min)
   a. Set up the label maker. Print labels for each zone: SPORTS, TOOLS, HOLIDAY, SEASONAL, AUTO, MISC (customize based on what the client actually has)
   b. Pack items into the 8 clear bins by category. Don't overfill — lids must close fully
   c. Apply the label to the FRONT CENTER of each bin
   d. Place bins on shelves by frequency of use: stuff they use weekly goes at eye level, seasonal stuff goes up high or on the overhead rack
   e. Items that don't fit in bins (large tools, ladders, bikes) get wall or floor positions. Group them by type
   f. Step back and look at the whole garage. Would a stranger know where to find a screwdriver? A holiday decoration? If not, re-organize
6. Final Detail (20 min)
   a. Sweep or blow any dust/debris created during install
   b. Wipe down all installed cabinet surfaces with a damp rag
   c. Straighten all bins so labels face forward
   d. Take AFTER photos: same 6+ angles as the BEFORE photos. Make sure the garage looks its absolute best
7. Client Walkthrough (15 min)
   a. Walk the client through zone by zone. "Your sports gear is here, tools are here, holiday is up top..."
   b. Show them how the bin system works. Open a bin, show the label
   c. Hand them the 30-Day Clutter-Free Guarantee card. Explain: "If anything shifts or you're not happy in the next 30 days, call us and we'll come back free"
   d. Ask for a Google review (once, politely)
   e. Load haul-away items into truck (see Undergraduate step 6)
   f. Check out on the app

DOCTORATE — White-Glove (3 scholars, full day 8+ hours):
1. Setup & Safety (15 min)
   a. All 3 scholars: gloves, safety glasses, dust masks
   b. Vehicles out of garage
   c. BEFORE photos: minimum 12 angles — all 4 walls (2 angles each), ceiling, floor, any particularly cluttered areas get close-ups
   d. Check in on app
2. Full Pull-Out (60-90 min)
   a. Same micro-sort zones as Graduate, but use furniture pads under any items that look valuable or fragile
   b. 3 scholars = faster pull-out. Two people carry, one person sorts at the zones
   c. Flag resale items for admin
   d. Heavy lift and hazmat rules same as above
3. Deep Clean (45-60 min)
   a. Degrease ALL wall surfaces (not just stained spots), floor, and any built-in shelving that's staying
   b. Power wash floor — extra attention to edges and corners
   c. Wipe down garage door tracks and the interior of any windows
   d. This is white-glove — when you think it's clean, clean it again
4. Install All Storage Systems (90-150 min)
   a. Follow job-specific INSTALLATION SPECIFICATIONS section
   b. Order: overhead racks first (you need ceiling access without floor obstructions), then wall cabinets, then floor cabinets, then free-standing shelving
   c. With 3 scholars: one can start assembly while two do the mounting. But ALL drilling/bolting requires the person NOT on the ladder to be spotting/holding
   d. Every installed item gets checked with a level BEFORE and AFTER final tightening
5. Premium Organized Reload (90-120 min)
   a. 16 premium bins = more categories. Print labels for each: SPORTS, TOOLS-HAND, TOOLS-POWER, HOLIDAY-CHRISTMAS, HOLIDAY-HALLOWEEN, SEASONAL-SUMMER, SEASONAL-WINTER, AUTO, OUTDOOR, CAMPING, CLEANING, HARDWARE, etc. — customize to what the client actually owns
   b. Pack items neatly. Face labels forward. Arrange bins in logical groups
   c. Add SEASONAL ROTATION TAGS: colored tags on seasonal bins. E.g., green tag = summer gear (front access May-Sep), orange tag = fall/winter gear (rotate forward Oct-Apr). Explain the system to the client during walkthrough
   d. Cable/cord management: bundle loose cords with zip ties. Coil extension cords neatly. Hang power tool cords, don't let them dangle
   e. Place furniture pads under all heavy floor items (floor cabinets, large toolboxes, anything that could scratch the floor or slide)
6. Final White-Glove Detail (30 min)
   a. Walk the entire garage slowly. Check every bin is aligned, every label faces forward, every surface is wiped
   b. Check that all installed items are level one final time
   c. Place furniture pads under any remaining heavy items
   d. Take AFTER photos: minimum 12 angles matching the before photos. Include close-ups of the bin labels, installed products, and the overall space
   e. The garage should look like a magazine photo. If it doesn't, find what's off and fix it
7. Client Walkthrough (20 min)
   a. Full zone-by-zone tour
   b. Demo the bin system AND the seasonal rotation system
   c. Show how the overhead rack works. Explain the weight limit ("up to 600 lbs spread evenly — don't put all the weight on one side")
   d. Explain cabinet/shelf maintenance: "Just wipe with a damp cloth. Don't put wet items directly on the bamboo/stainless top"
   e. Hand over the guarantee card
   f. Schedule the included return visit: "We'll come back within 30 days to make sure everything is still working. What week works for you?"
   g. Ask for Google review
   h. Check out on app

═══════════════════════════════════════
  QUALITY STANDARDS BY TIER
═══════════════════════════════════════

UNDERGRADUATE — Must pass these checks before leaving:
- Floor is swept/blown clean — no visible dust or debris in corners
- All KEEP items are back in the garage and grouped by type
- 1 shelf is installed, level, and anchored with anti-tip bracket
- BEFORE and AFTER photos are uploaded to the app (min 4 each)
- Client has been walked through the space
- Haul-away is loaded in the truck
- Driveway is clean (no debris from the sort)

GRADUATE — Must pass ALL Undergraduate checks PLUS:
- Floor has been power-washed and is dry
- ALL items are in labeled bins or have designated spots (nothing loose/random)
- All 8 bins have labels and are placed logically
- ALL installed products (shelving, cabinets, overhead) are level, secured, and anti-tip/lag bolted
- BEFORE and AFTER photos (6+ angles each) uploaded to app
- 30-Day Guarantee card handed to client
- No tools or supplies left behind

DOCTORATE — Must pass ALL Graduate checks PLUS:
- 16 bins with printed labels, all facing forward
- Seasonal rotation tags applied and explained to client
- Furniture pads under ALL heavy floor items
- Cable/cord management on ALL visible cables
- Every surface wiped down after install (no dust from drilling)
- Return visit scheduled with client (date in the app)
- BEFORE and AFTER photos (12+ angles each) uploaded to app
- The garage looks magazine-ready

═══════════════════════════════════════
  COMMON MISTAKES TO CALL OUT
═══════════════════════════════════════

In your SOP, PROACTIVELY warn about these common beginner mistakes:
- Drilling into drywall only (no stud) — the shelf/rack WILL fall. Always verify the stud with a stud finder
- Forgetting the anti-tip bracket on shelving — this is a safety hazard, never skip it
- Not checking level before tightening — once lag bolts are tight, it's very hard to adjust. Check level BEFORE final tightening
- Loading the truck before confirming with the client — always do a final "is this trash?" check
- Not taking enough photos — more is always better. Take photos from the same angles before and after
- Ignoring hazmat items — paint, propane, batteries, and chemicals need special handling. Set aside and flag for admin
- Rushing through the clean — the clean is what makes the transformation visible. A half-clean floor ruins the whole effect
- Not introducing yourself to the client — first impressions matter. "Hi, I'm [name] from Garage Scholars. We're going to transform your garage today"

═══════════════════════════════════════
  OUTPUT FORMAT
═══════════════════════════════════════

Always output exactly these 9 sections. Be EXTREMELY detailed in every section. When in doubt, over-explain — a scholar reading this should never have to wonder "but how do I actually do that?"

## 1. PRE-JOB LOADOUT
[Itemized list of EVERY tool, material, product, bin, hardware piece, and PPE item this job needs. Be specific: "6x 5/16" x 3" lag bolts" not just "lag bolts". Include quantities. A scholar should be able to read this list in the shop and load the truck without missing anything.]

## 2. SITE ASSESSMENT (First 10 Minutes)
[Zone-by-zone observations from the intake photos. For each wall/area: describe condition, clutter level, estimated effort, and any access issues. End with a bullet list of things to CONFIRM ON ARRIVAL (things you can't tell from photos). If no photos provided, open with "No intake photos — complete full site assessment on arrival" and list everything they need to check.]

## 3. PHASE SEQUENCE
[This is the heart of the SOP. Numbered phases with lettered sub-steps. EVERY phase gets an estimated time. EVERY action that involves a tool, a measurement, or a decision gets its own lettered sub-step. This section auto-converts to a checklist in the app. Format:

1. Phase Name (estimated time)
   a. First specific action
   b. Second specific action
   c. Third specific action — include STOP AND CHECK if this is before an irreversible step

Include at least 5-8 sub-steps per phase for Graduate and Doctorate jobs. Do not write vague steps like "install shelving" — instead break it into every physical action: find studs, mark wall, check level, pre-drill, mount bracket, etc.]

## 4. INSTALLATION SPECIFICATIONS
[Product-by-product walkthrough. For EACH product being installed, write the FULL step-by-step installation as if the reader has never installed anything before. Reference the tool how-to guides above. Include: exact bolt sizes and counts, exact measurements, where to measure from, how to check your work, and what to do if something goes wrong.]

## 5. SAFETY & WASTE PROTOCOLS
[PPE requirements for EACH phase (not just "wear PPE"). Specific lifting instructions. Hazmat identification and handling. What to do if someone gets hurt. Haul-away sorting rules: what goes to landfill vs donation vs resale. Truck loading order. Driveway etiquette (don't block neighbor's driveway).]

## 6. TIME BUDGET
[Phase-by-phase time breakdown with a running total. Compare the total to the package time allocation. If the job will run tight or over, say so clearly: "This job may run 1 hour over the 7-hour allocation due to [reason]. Recommendation: [solution]".]

## 7. GARAGE SCHOLARS QUALITY STANDARD
[The specific checklist of non-negotiable finish items for THIS tier. Write it as a pass/fail list. A scholar should be able to read each item and check yes or no. Include photo documentation requirements.]

## 8. CLIENT HANDOFF CHECKLIST
[Step-by-step script for the client walkthrough. What to say, what to show, what to hand them. Include the exact words for asking for a Google review. Include what to do if the client is unhappy with something.]

## 9. ADMIN NOTES
[Flags for the team lead: timeline risk, unusual conditions, items with resale value, upsell opportunities, scheduling notes, anything that needs a heads-up before the crew arrives.]`;

const buildSopUserMessage = (job: FirebaseFirestore.DocumentData, hasImages: boolean, adminNotes?: string) => {
  const tier = job.packageTier || job.package || "graduate";
  const packageDesc = PACKAGE_DATA[tier] || PACKAGE_DATA.graduate;

  // Resolve product details for richer context
  const shelvingRaw = job.shelvingSelections || "None specified";
  const installNotes: string[] = [];

  // Detect Bold Series products and add install context
  if (shelvingRaw.includes("Bold Series")) {
    if (shelvingRaw.includes("Wall Cabinet")) {
      installNotes.push("BOLD WALL CABINETS: Mount at 54\" from floor, lag bolt 5/16\" x 3\" into studs (16\" OC), min 2 studs per cabinet.");
    }
    if (/\d-Pc.*System|\d-Piece/i.test(shelvingRaw)) {
      installNotes.push("BOLD FLOOR+WALL SYSTEM: Install wall units first, then floor cabinets. Level floor units with shims, anchor to wall stud. Connect multi-piece sets with included bolts. Worktops go on last, secure with clips from underneath.");
    }
    if (/Bamboo|Stainless/i.test(shelvingRaw)) {
      installNotes.push("WORKTOP NOTE: Bamboo/stainless tops rest on cabinet frames — install all cabinets first, verify level, then place tops and secure with included clips.");
    }
  }

  // Detect overhead racks
  if (shelvingRaw.includes("Overhead Rack")) {
    if (shelvingRaw.includes('32"D')) {
      installNotes.push("OVERHEAD 32\"D: Requires 8ft min ceiling. Locate joists with stud finder, 4 anchor points, 3/8\" x 3\" lag bolts into joists only. Two-person job. 7ft min clearance below for vehicle doors.");
    }
    if (shelvingRaw.includes('48"D')) {
      installNotes.push("OVERHEAD 48\"D: Requires 9ft min ceiling. Locate joists with stud finder, 4 anchor points, 3/8\" x 3\" lag bolts into joists only. Two-person job. 7ft min clearance below for vehicle doors.");
    }
    if (shelvingRaw.includes("Bin Rack")) {
      installNotes.push("CEILING BIN RACK: Mount into joists, 4 anchor points. Verify joist direction before marking.");
    }
  }

  // Detect shelving units
  if (shelvingRaw.includes("5-Tier")) {
    installNotes.push("5-TIER SHELVING (48\"W): Assemble upright, level with adjustable feet, MUST anchor to wall with anti-tip bracket + 1/4\" lag bolt.");
  }
  if (shelvingRaw.includes("4-Tier")) {
    installNotes.push("4-TIER SHELVING (60\"W): Assemble upright, needs 5ft clear wall space, level with adjustable feet, MUST anchor with anti-tip bracket.");
  }

  // Detect flooring add-ons
  const addOnsRaw = job.addOns || "None selected";
  if (addOnsRaw.includes("Click-In")) {
    installNotes.push("CLICK-IN FLOORING: Sweep and degrease floor first, start from back wall toward door, rubber mallet to snap tiles, 1/4\" expansion gap at walls. Cut edges with utility knife.");
  }
  if (addOnsRaw.includes("Polyaspartic")) {
    installNotes.push("POLYASPARTIC COATING: Subcontracted — coordinate scheduling with flooring crew. Garage must be fully empty. 24hr cure time before loading.");
  }

  const parts = [
    `Package: ${tier.toUpperCase()} — ${packageDesc}`,
    `Shelving & Storage: ${shelvingRaw}`,
    `Add-Ons: ${addOnsRaw}`,
  ];

  if (installNotes.length > 0) {
    parts.push(`\nPRODUCT INSTALLATION CONTEXT:\n${installNotes.join("\n")}`);
  }

  parts.push(
    `\nAddress: ${job.address || "Unknown"}`,
    `Client Description: ${job.description || "No description provided"}`,
    `Access Constraints: ${job.accessConstraints || "None noted"}`,
    `Sell vs Keep Preference: ${job.sellVsKeepPreference || "decide on arrival"}`,
    `Garage Size: ${job.garageSize || "assess on arrival"}`,
  );

  if (!hasImages) {
    parts.push("\nNo intake photos provided — Section 2 should open with 'No intake photos provided — complete full site assessment on arrival'.");
  }

  if (adminNotes) {
    parts.push(`\nAdmin notes from team lead: ${adminNotes}`);
  }

  parts.push("\nGenerate the complete job SOP with all 9 sections.");
  return parts.join("\n");
};

export const generateSopForJob = onCall({ timeoutSeconds: 300, memory: "1GiB", secrets: ["ANTHROPIC_API_KEY"] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { jobId, adminNotes } = request.data as { jobId?: string; adminNotes?: string };
  if (!jobId) {
    throw new HttpsError("invalid-argument", "Missing jobId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new HttpsError("failed-precondition", "ANTHROPIC_API_KEY is not configured. Run: firebase functions:secrets:set ANTHROPIC_API_KEY");
  }

  const jobRef = db.collection("gs_jobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) {
    throw new HttpsError("not-found", "Job not found.");
  }

  const jobData = { id: jobSnap.id, ...jobSnap.data() } as { id: string; intakeMediaPaths?: string[] } & FirebaseFirestore.DocumentData;
  const intakePaths: string[] = Array.isArray(jobData.intakeMediaPaths) ? jobData.intakeMediaPaths : [];

  // Download images as base64 for Claude vision
  const bucket = storage.bucket();
  const imageBlocks: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [];

  for (const rawPath of intakePaths.slice(0, 3)) {
    try {
      // Strip full URL prefix if intakeMediaPaths stores public URLs
      let storagePath = rawPath;
      const bucketName = bucket.name; // e.g. "garage-scholars-v2.firebasestorage.app"
      const prefix = `https://storage.googleapis.com/${bucketName}/`;
      if (storagePath.startsWith(prefix)) {
        storagePath = storagePath.slice(prefix.length);
      }
      // Also handle firebasestorage.googleapis.com format
      const altPrefix = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
      if (storagePath.startsWith(altPrefix)) {
        storagePath = decodeURIComponent(storagePath.slice(altPrefix.length).split("?")[0]);
      }

      console.log(`Downloading image: ${storagePath}`);
      const [rawBuffer] = await bucket.file(storagePath).download();

      // Resize to max 1600px longest side + JPEG quality 80 to stay under Claude's 5MB limit
      const resized = await sharp(rawBuffer)
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      console.log(`Resized image: ${rawBuffer.length} → ${resized.length} bytes`);
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") }
      });
      console.log(`Successfully downloaded image: ${storagePath}`);
    } catch (err) {
      console.warn(`Failed to download intake image: ${rawPath}`, err);
    }
  }

  console.log(`Calling Claude API with ${imageBlocks.length} images for job ${jobId}`);

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const userText = buildSopUserMessage(jobData, imageBlocks.length > 0, adminNotes);

  const userContent: Array<any> = [
    ...imageBlocks,
    { type: "text", text: userText }
  ];

  let generatedSOP = "";

  try {
    console.log(`SOP generation starting...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 16384,
      system: SOP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }]
    });

    const textBlock = response.content.find((b: any) => b.type === "text");
    generatedSOP = textBlock ? (textBlock as any).text : "";
    console.log(`Got ${generatedSOP.length} chars, has sections: ${generatedSOP.includes("## 1.")}`);
  } catch (error) {
    console.error(`SOP generation failed:`, (error as Error).message);
    throw new HttpsError("internal", `Failed to generate SOP: ${(error as Error).message}`);
  }

  if (!generatedSOP) {
    console.error(`SOP generation returned empty response for job ${jobId}`);
    throw new HttpsError("internal", "SOP generation returned empty response");
  }

  // Save generated SOP directly on the job document
  console.log(`Saving SOP (${generatedSOP.length} chars) to job ${jobId}`);
  await jobRef.set({
    generatedSOP,
    status: "SOP_NEEDS_REVIEW",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`SOP successfully saved for job ${jobId}`);
  return { ok: true, generatedSOP };
});

const requireAdmin = async (uid: string, email?: string) => {
  // Check if user email is in the admin list
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) {
    return;
  }

  // Fallback to checking Firestore role (for backward compatibility)
  const userSnap = await db.collection("users").doc(uid).get();
  const role = userSnap.exists ? userSnap.data()?.role : null;
  if (role !== "admin") {
    throw new HttpsError("permission-denied", "Admin role required.");
  }
};

// Sanitize a name for use in Storage folder paths (filesystem-safe)
const sanitizeForPath = (name: string): string =>
  name.trim().replace(/[^a-zA-Z0-9 -]/g, '').replace(/\s+/g, ' ').trim() || 'Unknown';

// Build the human-readable storage folder name: "ClientName - clientId"
const buildClientFolder = (name: string, clientId: string): string =>
  `${sanitizeForPath(name)} - ${clientId}`;

// Find existing client by email or create a new one in the clients collection
// Returns { clientId, clientFolder } where clientFolder is the Storage folder name
const findOrCreateClient = async (
  name: string, email: string, phone?: string, source: 'scheduling' | 'resale' | 'both' = 'scheduling'
): Promise<{ clientId: string; clientFolder: string }> => {
  const existing = await db.collection('clients')
    .where('email', '==', email.toLowerCase().trim())
    .limit(1).get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data();
    // Use stored folder name if available, otherwise build it
    const clientFolder = data.storageFolderName || buildClientFolder(data.name || name, doc.id);
    // Backfill storageFolderName if missing
    if (!data.storageFolderName) {
      await doc.ref.update({ storageFolderName: clientFolder });
    }
    return { clientId: doc.id, clientFolder };
  }

  const clientRef = await db.collection('clients').add({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || null,
    source,
    createdAt: FieldValue.serverTimestamp(),
    storageFolderName: '', // placeholder — set after we have the ID
    stats: {
      totalServiceJobs: 0,
      totalPropertiesServiced: 0,
      totalItemsListed: 0,
      totalItemsSold: 0,
      totalRevenue: 0
    }
  });

  const clientFolder = buildClientFolder(name, clientRef.id);
  await clientRef.update({ storageFolderName: clientFolder });

  return { clientId: clientRef.id, clientFolder };
};

export const approveSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  console.log("Looking for user with requestId:", requestId);
  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  console.log("User query result - empty?", userQuery.empty, "size:", userQuery.size);

  if (userQuery.empty) {
    // Try to find user by email as fallback
    const reqData = reqSnap.data();
    const email = reqData?.email;
    const name = reqData?.name || "Scholar";
    console.log("User not found by requestId, trying email:", email);

    if (email) {
      const emailQuery = await db.collection("users").where("email", "==", email).limit(1).get();
      console.log("Email query result - empty?", emailQuery.empty, "size:", emailQuery.size);

      if (!emailQuery.empty) {
        const userDoc = emailQuery.docs[0];
        console.log("Found user by email, updating with requestId");
        // Update the user doc with the requestId and approve
        await userDoc.ref.set({
          requestId,
          role: "scholar",
          status: "active",
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        }, { merge: true });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        return { ok: true };
      }

      // User doesn't exist in Firestore at all - find them in Firebase Auth and create the doc
      console.log("User not found in Firestore, checking Firebase Auth for email:", email);
      try {
        const authUser = await adminAuth.getUserByEmail(email);
        console.log("Found user in Firebase Auth:", authUser.uid);

        // Create the user document
        await db.collection("users").doc(authUser.uid).set({
          email,
          name,
          role: "scholar",
          status: "active",
          requestId,
          createdAt: FieldValue.serverTimestamp(),
          approvedAt: FieldValue.serverTimestamp(),
          approvedByUid: request.auth.uid
        });

        await requestRef.set({
          status: "approved",
          decidedAt: FieldValue.serverTimestamp(),
          decidedByUid: request.auth.uid
        }, { merge: true });

        console.log("Created user document and approved");
        return { ok: true };
      } catch (authError) {
        console.error("Firebase Auth lookup failed:", authError);
      }
    }

    // Last resort: debug all users to see what's in the collection
    console.log("Failed to find user by requestId, email, or Firebase Auth");

    // Get all users to debug
    const allUsers = await db.collection("users").limit(10).get();
    console.log("Total users in collection:", allUsers.size);
    allUsers.docs.forEach(doc => {
      console.log("User doc:", doc.id, doc.data());
    });

    throw new HttpsError("not-found", `User for request not found. Checked requestId: ${requestId}, email: ${email || 'none'}`);
  }
  const userDoc = userQuery.docs[0];
  console.log("Found user document:", userDoc.id, userDoc.data());

  await requestRef.set({
    status: "approved",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByUid: request.auth.uid
  }, { merge: true });

  await userDoc.ref.set({
    role: "scholar",
    status: "active",
    approvedAt: FieldValue.serverTimestamp(),
    approvedByUid: request.auth.uid
  }, { merge: true });

  return { ok: true };
});

export const declineSignup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const { requestId } = request.data as { requestId?: string };
  if (!requestId) {
    throw new HttpsError("invalid-argument", "Missing requestId.");
  }

  await requireAdmin(request.auth.uid, request.auth.token.email);

  const requestRef = db.collection("signupRequests").doc(requestId);
  const reqSnap = await requestRef.get();
  if (!reqSnap.exists) {
    throw new HttpsError("not-found", "Signup request not found.");
  }

  const userQuery = await db.collection("users").where("requestId", "==", requestId).limit(1).get();
  const userDoc = userQuery.empty ? null : userQuery.docs[0];

  await requestRef.set({
    status: "declined",
    decidedAt: FieldValue.serverTimestamp(),
    decidedByUid: request.auth.uid
  }, { merge: true });

  if (userDoc) {
    await userDoc.ref.set({
      status: "disabled"
    }, { merge: true });
    await adminAuth.deleteUser(userDoc.id).catch(() => null);
  }

  return { ok: true };
});

/**
 * Send email notification when job status changes to REVIEW_PENDING
 * Requires Firebase Email Extension to be installed
 */
export const sendJobReviewEmail = onDocumentWritten("serviceJobs/{jobId}", async (event) => {
  const beforeData = event.data?.before?.data();
  const afterData = event.data?.after?.data();

  // Only trigger when status changes to REVIEW_PENDING
  if (!afterData || afterData.status !== "REVIEW_PENDING") {
    return;
  }

  // Don't send duplicate emails if already REVIEW_PENDING
  if (beforeData?.status === "REVIEW_PENDING") {
    return;
  }

  const jobId = event.params.jobId;
  console.log(`Job ${jobId} is now pending review. Sending email notification...`);

  try {
    const bucket = storage.bucket();

    // Get download URLs for media
    const getDownloadUrl = async (path: string): Promise<string> => {
      if (!path || path === '') return '';
      if (path.startsWith('http')) return path; // Already a URL
      try {
        const [url] = await bucket.file(path).getSignedUrl({
          action: "read",
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        return url;
      } catch (error) {
        console.error(`Failed to get URL for ${path}:`, error);
        return '';
      }
    };

    const checkInPhotoUrl = afterData.checkInMedia?.photoFrontOfHouse
      ? await getDownloadUrl(afterData.checkInMedia.photoFrontOfHouse)
      : '';

    const checkOutPhotoUrl = afterData.checkOutMedia?.photoFrontOfHouse
      ? await getDownloadUrl(afterData.checkOutMedia.photoFrontOfHouse)
      : '';

    const checkOutVideoUrl = afterData.checkOutMedia?.videoGarage
      ? await getDownloadUrl(afterData.checkOutMedia.videoGarage)
      : '';

    // Calculate work duration
    let workDuration = 'N/A';
    if (afterData.checkInTime && afterData.checkOutTime) {
      const minutes = Math.round(
        (new Date(afterData.checkOutTime).getTime() - new Date(afterData.checkInTime).getTime()) / (1000 * 60)
      );
      workDuration = `${minutes} minutes`;
    }

    // Generate secure approval token (simple hash of jobId + timestamp)
    const approvalToken = Buffer.from(`${jobId}-${Date.now()}`).toString('base64');

    // Create email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Job Review Required</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #2a5f5f 0%, #1f4a4a 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #2a5f5f;
      padding: 20px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .info-label {
      font-weight: 600;
      color: #555;
    }
    .info-value {
      color: #333;
    }
    .media-section {
      margin: 30px 0;
    }
    .media-section h3 {
      color: #2a5f5f;
      margin-bottom: 15px;
    }
    .media-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }
    .media-item img {
      width: 100%;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
    }
    .media-item p {
      text-align: center;
      font-size: 13px;
      color: #666;
      margin: 8px 0 0 0;
    }
    .video-link {
      display: block;
      background: #f0f0f0;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      text-decoration: none;
      color: #2a5f5f;
      font-weight: 600;
      margin: 15px 0;
    }
    .video-link:hover {
      background: #e0e0e0;
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .approve-button {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 700;
      font-size: 16px;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
    }
    .approve-button:hover {
      background: #059669;
    }
    .dashboard-link {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 15px;
    }
    .payment-info {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      font-size: 13px;
      color: #1e40af;
    }
    .footer {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏠 Job Review Required</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">A scholar has completed a service job</p>
  </div>

  <div class="info-box">
    <div class="info-row">
      <span class="info-label">Client:</span>
      <span class="info-value">${afterData.clientName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Address:</span>
      <span class="info-value">${afterData.address || 'N/A'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Scholar:</span>
      <span class="info-value">${afterData.assigneeName || 'Unknown'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Total Payout:</span>
      <span class="info-value" style="font-weight: 700; color: #10b981;">$${afterData.pay || 0}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Work Duration:</span>
      <span class="info-value">${workDuration}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Job ID:</span>
      <span class="info-value" style="font-family: monospace; font-size: 12px;">${jobId}</span>
    </div>
  </div>

  <div class="payment-info">
    <strong>💰 Payment Policy:</strong> Approval triggers 50% immediate payment ($${(afterData.pay || 0) / 2}).
    The remaining 50% is automatically released 24 hours after job completion if no client complaints are filed.
  </div>

  <div class="media-section">
    <h3>📸 Quality Assurance Photos</h3>
    <div class="media-grid">
      <div class="media-item">
        ${checkInPhotoUrl ? `<img src="${checkInPhotoUrl}" alt="Check-In Photo" />` : '<p>No check-in photo</p>'}
        <p>Check-In</p>
      </div>
      <div class="media-item">
        ${checkOutPhotoUrl ? `<img src="${checkOutPhotoUrl}" alt="Check-Out Photo" />` : '<p>No check-out photo</p>'}
        <p>Check-Out</p>
      </div>
    </div>

    ${checkOutVideoUrl ? `
      <a href="${checkOutVideoUrl}" class="video-link" target="_blank">
        🎥 View Check-Out Video (Garage Walkthrough)
      </a>
    ` : '<p style="color: #dc2626; font-weight: 600;">⚠️ No check-out video available</p>'}
  </div>

  <div class="button-container">
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin?approve=${approvalToken}" class="approve-button">
      ✅ Approve & Pay $${(afterData.pay || 0) / 2} (50% now)
    </a>
    <br/>
    <a href="${process.env.SCHEDULING_APP_URL || 'https://your-scheduling-app.vercel.app'}/admin" class="dashboard-link">
      Open Admin Dashboard
    </a>
  </div>

  <div class="footer">
    <p>This is an automated notification from Garage Scholars Scheduling System</p>
    <p>Job completed at ${new Date(afterData.checkOutTime).toLocaleString()}</p>
  </div>
</body>
</html>
    `;

    // Write to 'mail' collection (monitored by Firebase Email Extension)
    await db.collection('mail').add({
      to: ['garagescholars@gmail.com'], // Centralized review inbox
      message: {
        subject: `🔔 Review Required: ${afterData.clientName} - $${afterData.pay}`,
        html: emailHtml,
      },
      jobId: jobId,
      approvalToken: approvalToken,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`Email notification queued for job ${jobId}`);
  } catch (error) {
    console.error(`Failed to send email for job ${jobId}:`, error);
  }
});

// Submit quote request from website
export const submitQuoteRequest = onCall(
  { cors: true, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
  console.log('submitQuoteRequest handler entered');
  console.log('request.data keys:', Object.keys(request.data || {}));

  const {
    name,
    email,
    phone,
    zipcode,
    serviceType,
    package: packageTier,
    garageSize,
    description,
    photoData // Array of base64 encoded images if present
  } = request.data;

  // Validate required fields (package is optional — HTML form doesn't require it)
  if (!name || !email || !phone || !zipcode || !serviceType) {
    throw new HttpsError("invalid-argument", "Missing required fields: name, email, phone, zipcode, and serviceType are required.");
  }

  console.log(`submitQuoteRequest called: name=${name}, email=${email}, serviceType=${serviceType}, package=${packageTier || 'none'}`);

  try {
    // Step 1: Find or create client in the clients collection
    const { clientId, clientFolder } = await findOrCreateClient(name, email, phone);
    console.log(`Client resolved: ${clientId} (folder: ${clientFolder})`);

    // Step 2: Create quote request document
    const quoteRequestRef = await db.collection('quoteRequests').add({
      name,
      email,
      phone,
      zipcode,
      serviceType,
      package: packageTier || null,
      garageSize: garageSize || null,
      description: description || null,
      status: 'new',
      clientId,
      createdAt: FieldValue.serverTimestamp(),
      source: 'website'
    });

    console.log(`Quote request created: ${quoteRequestRef.id}`);

    // Step 3: Create draft job with LEAD status (before photo upload so we have jobId for path)
    const draftJobRef = await db.collection('serviceJobs').add({
      clientName: name,
      clientEmail: email,
      clientPhone: phone,
      clientId,
      clientFolder,
      address: zipcode ? `ZIP: ${zipcode}` : 'Address TBD',
      zipcode: zipcode,
      description: description || 'New lead from website quote form',
      date: new Date().toISOString(),
      scheduledEndTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      pay: 0,
      clientPrice: 0,
      status: 'LEAD',
      locationLat: 0,
      locationLng: 0,
      checklist: [],
      serviceType,
      package: packageTier || null,
      garageSize: garageSize || null,
      intakeMediaPaths: [],
      quoteRequestId: quoteRequestRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`Draft job created with LEAD status: ${draftJobRef.id}`);

    // Link the job back to the quote request
    await quoteRequestRef.update({ jobId: draftJobRef.id });

    // Step 4: Upload photos to client-centric Storage path with human-readable names
    const intakeMediaPaths: string[] = [];
    const photoEmailUrls: string[] = [];
    const bucket = storage.bucket();
    if (photoData && Array.isArray(photoData) && photoData.length > 0) {
      console.log(`Uploading ${photoData.length} photos to clients/${clientFolder}/quote/photos/...`);

      for (let i = 0; i < photoData.length; i++) {
        try {
          const { base64, filename } = photoData[i];
          const buffer = Buffer.from(base64, 'base64');
          console.log(`Photo ${i}: ${filename}, ${buffer.length} bytes`);
          const storagePath = `clients/${clientFolder}/quote/photos/photo-${i + 1}.jpg`;

          // Generate a download token for email embeds (avoids getSignedUrl permission issues)
          const downloadToken = crypto.randomUUID();
          const file = bucket.file(storagePath);
          await file.save(buffer, {
            metadata: {
              contentType: 'image/jpeg',
              metadata: { firebaseStorageDownloadTokens: downloadToken }
            },
          });

          intakeMediaPaths.push(storagePath);
          // Build a public download URL using the token
          const encodedPath = encodeURIComponent(storagePath);
          photoEmailUrls.push(
            `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`
          );
          console.log(`Photo ${i} uploaded: ${storagePath}`);
        } catch (photoError) {
          console.error(`Error uploading photo ${i}:`, photoError);
        }
      }

      // Update job and quote request with storage paths
      if (intakeMediaPaths.length > 0) {
        await draftJobRef.update({ intakeMediaPaths });
        await quoteRequestRef.update({ photoStoragePaths: intakeMediaPaths });
        console.log(`${intakeMediaPaths.length} photo paths saved`);
      }
    }

    // Step 5: Send email notification to admin (use signed URLs for photos)
    const serviceTypeLabels: { [key: string]: string } = {
      'get-clean': 'Get Clean',
      'get-organized': 'Get Organized',
      'get-strong': 'Get Strong',
      'resale': 'Resale Concierge',
      'cleaning': 'Cleaning',
      'organization': 'Organization',
      'gym': 'Gym Setup',
      'full': 'Full Transformation'
    };

    const packageLabels: { [key: string]: string } = {
      'undergraduate': 'Undergraduate',
      'graduate': 'Graduate',
      'doctorate': 'Doctorate'
    };

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6E9D7B; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .field { margin-bottom: 15px; }
    .field-label { font-weight: bold; color: #27362e; }
    .field-value { margin-top: 5px; }
    .photos { margin-top: 20px; }
    .photos img { max-width: 200px; margin: 10px; border: 1px solid #ddd; }
    .footer { margin-top: 20px; padding: 15px; background-color: #f0f0f0; border-radius: 0 0 8px 8px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🏠 New Quote Request</h2>
    </div>

    <div class="content">
      <div class="field">
        <div class="field-label">Contact Information:</div>
        <div class="field-value">
          <strong>Name:</strong> ${name}<br>
          <strong>Email:</strong> ${email}<br>
          <strong>Phone:</strong> ${phone}<br>
          <strong>ZIP Code:</strong> ${zipcode}
        </div>
      </div>

      <div class="field">
        <div class="field-label">Service Details:</div>
        <div class="field-value">
          <strong>Service Type:</strong> ${serviceTypeLabels[serviceType] || serviceType}<br>
          <strong>Package:</strong> ${packageLabels[packageTier] || packageTier || 'Not selected'}
          ${garageSize ? `<br><strong>Garage Size:</strong> ${garageSize}` : ''}
        </div>
      </div>

      ${description ? `
      <div class="field">
        <div class="field-label">Project Description:</div>
        <div class="field-value">${description}</div>
      </div>
      ` : ''}

      ${photoEmailUrls.length > 0 ? `
      <div class="photos">
        <div class="field-label">Photos (${photoEmailUrls.length}):</div>
        ${photoEmailUrls.map(url => `<img src="${url}" alt="Garage photo">`).join('')}
      </div>
      ` : ''}
    </div>

    <div class="footer">
      <p>Quote Request ID: ${quoteRequestRef.id}</p>
      <p>Client ID: ${clientId}</p>
      <p>Submitted at ${new Date().toLocaleString()}</p>
      <p><a href="https://console.firebase.google.com/project/${process.env.GCLOUD_PROJECT}/firestore/data/quoteRequests/${quoteRequestRef.id}">View in Firebase Console</a></p>
    </div>
  </div>
</body>
</html>
    `;

    await db.collection('mail').add({
      to: ['garagescholars@gmail.com'],
      message: {
        subject: `📋 New Quote Request: ${name} - ${serviceTypeLabels[serviceType] || serviceType} (${packageLabels[packageTier] || 'No package'})`,
        html: emailHtml,
      },
      quoteRequestId: quoteRequestRef.id,
      clientId,
      createdAt: FieldValue.serverTimestamp()
    });

    console.log(`Email notification queued for quote request ${quoteRequestRef.id}`);

    return {
      success: true,
      quoteRequestId: quoteRequestRef.id,
      jobId: draftJobRef.id,
      clientId,
      message: 'Quote request submitted successfully and draft job created'
    };

  } catch (error) {
    console.error('Error submitting quote request:', (error as Error).message, (error as Error).stack);
    throw new HttpsError("internal", `Failed to submit quote request: ${(error as Error).message}`);
  }
});
