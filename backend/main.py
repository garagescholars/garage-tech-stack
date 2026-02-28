import time
import os
import json
import uuid
import threading
from enum import Enum
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

# --- CONFIGURATION (UPDATE THIS) -------------------------------------------
# Run 'chrome://version' in your browser to find this path.
CHROME_PROFILE_PATH = r"Users/tylersodia/Library/Application Support/Google/Chrome/"
# ---------------------------------------------------------------------------

app = FastAPI()
DB_FILE = "inventory.json"

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- EXPANDED DATA MODELS ---
# Matches standard Craigslist/FB Categories
class Category(str, Enum):
    ANTIQUES = "antiques"
    APPLIANCES = "appliances"
    ARTS_CRAFTS = "arts+crafts"
    AUTO_PARTS = "auto parts"
    BABY_KID = "baby+kid"
    BIKES = "bikes"
    BOOKS = "books"
    CARS_TRUCKS = "cars+trucks"
    CLOTHING = "clothes+acc"
    COLLECTIBLES = "collectibles"
    COMPUTERS = "computers"
    ELECTRONICS = "electronics"
    FARM_GARDEN = "farm+garden"
    FREE = "free"
    FURNITURE = "furniture"
    GARAGE_SALE = "garage sale"
    GENERAL = "general"
    HOUSEHOLD = "household"
    JEWELRY = "jewelry"
    MATERIALS = "materials"
    MUSICAL_INSTRUMENTS = "musical instruments"
    PHOTO_VIDEO = "photo+video"
    SPORTING = "sporting"
    TOOLS = "tools"
    TOYS_GAMES = "toys+games"
    VIDEO_GAMING = "video gaming"
    OTHER = "other"

class ItemStatus(str, Enum):
    DRAFT = "Draft"
    PUBLISHED = "Published"

class Item(BaseModel):
    id: Optional[str] = None
    title: str
    price: int
    zip_code: str
    description: str
    condition: str
    category: str # Accepts any string, but frontend sends specific ones
    image_path: Optional[str] = None
    status: ItemStatus = ItemStatus.DRAFT

# --- DATABASE FUNCTIONS ---
def load_db():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_db(items):
    with open(DB_FILE, "w") as f:
        json.dump(items, f, indent=2)

# --- AUTOMATION LOGS ---
logs = []

def log(message: str):
    print(message)
    logs.append(f"> {message}")

@app.get("/logs")
def get_logs():
    return {"logs": logs}

# --- AUTOMATION ENGINE ---
class MarketplaceAutomator:
    def __init__(self):
        self.driver = None

    def start_driver(self):
        log("Initiating Chrome Driver with User Profile...")
        options = Options()
        options.add_argument(f"user-data-dir={CHROME_PROFILE_PATH}")
        options.add_argument("profile-directory=Default")
        options.add_argument("--start-maximized")
        options.add_experimental_option("detach", True)

        try:
            self.driver = webdriver.Chrome(
                service=Service(ChromeDriverManager().install()), 
                options=options
            )
            log("Browser Launched successfully.")
        except Exception as e:
            log(f"ERROR launching browser: {str(e)}")
            raise e

    def post_to_facebook(self, item: Item):
        if not self.driver: return
        log("Navigating to Facebook Marketplace...")
        self.driver.get("https://www.facebook.com/marketplace/create/item")
        time.sleep(5)

        try:
            log(f"Filling Title: {item.title}")
            title_input = self.driver.find_element(By.XPATH, "//label[@aria-label='Title']//input")
            title_input.send_keys(item.title)
            
            log(f"Filling Price: {item.price}")
            price_input = self.driver.find_element(By.XPATH, "//label[@aria-label='Price']//input")
            price_input.send_keys(str(item.price))
            
            log("Filling Description...")
            desc_input = self.driver.find_element(By.XPATH, "//label[@aria-label='Description']//textarea")
            desc_input.send_keys(item.description)
            
            # Category selection logic would go here
            log(f"Category set to: {item.category} (Manual selection required for safety)")

        except Exception as e:
            log(f"Error on Facebook: {str(e)}")

    def post_to_craigslist(self, item: Item):
        if not self.driver: return
        log(f"Navigating to Craigslist...")
        # Change to your city if needed
        self.driver.get("https://denver.craigslist.org/d/for-sale/search/sss")
        
        log("Waiting for form fields (User must navigate to specific category page)...")
        try:
            # We assume user is on the posting page for this MVP
            self.driver.find_element(By.NAME, "PostingTitle").send_keys(item.title)
            self.driver.find_element(By.NAME, "price").send_keys(str(item.price))
            self.driver.find_element(By.NAME, "postal").send_keys(item.zip_code)
            self.driver.find_element(By.NAME, "PostingBody").send_keys(item.description)
            log("Craigslist form filled.")
            
        except Exception:
            log("Craigslist Page Not Ready: Navigate to the 'Create Posting' page and the robot will resume.")


# --- API ENDPOINTS ---

@app.get("/inventory")
def get_inventory():
    """Returns all saved items for the Inventory View"""
    return load_db()

@app.post("/items")
def save_item(item: Item):
    """Saves an item to the database without publishing"""
    items = load_db()
    if not item.id:
        item.id = str(uuid.uuid4())
    
    # Update existing or add new
    existing_index = next((index for (index, d) in enumerate(items) if d["id"] == item.id), None)
    if existing_index is not None:
        items[existing_index] = item.dict()
    else:
        items.append(item.dict())
    
    save_db(items)
    return item

@app.delete("/items/{item_id}")
def delete_item(item_id: str):
    items = load_db()
    items = [i for i in items if i["id"] != item_id]
    save_db(items)
    return {"status": "deleted"}

@app.post("/publish")
async def publish_listing(item: Item):
    logs.clear()
    log(f"Starting Automation for: {item.title}")
    
    # 1. Update status in DB
    items = load_db()
    for i in items:
        if i["id"] == item.id:
            i["status"] = ItemStatus.PUBLISHED
    save_db(items)

    # 2. Run Automation
    def run_automation_thread(item_data):
        automator = MarketplaceAutomator()
        try:
            automator.start_driver()
            automator.post_to_facebook(item_data)
            
            automator.driver.execute_script("window.open('');")
            automator.driver.switch_to.window(automator.driver.window_handles[1])
            automator.post_to_craigslist(item_data)
            log("Automation Sequence Complete.")
        except Exception as e:
            log(f"CRITICAL ERROR: {str(e)}")

    thread = threading.Thread(target=run_automation_thread, args=(item,))
    thread.start()
    
    return {"status": "started", "message": "Automation initiated."}