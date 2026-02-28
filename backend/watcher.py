import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import time
import base64
import os

# --- SELENIUM IMPORTS ---
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ==========================================
# 💳 PAYMENT & CONFIG
# ==========================================
PAYMENT_INFO = {
    "name": "Tyler Sodia",
    "cardNumber": "0000000000000000", # <--- UPDATE THIS
    "expMonth": "01",
    "expYear": "26",
    "cvc": "123",
    "address": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "zip": "80202",
    "phone": "7205073969"
}

# 1. CONNECT TO DATABASE
cred = credentials.Certificate('service-account.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

print("🤖 ROBOT ONLINE: Watching for 'Pending' items...")

# --- HELPERS ---
def scroll_down(driver, times=5):
    for _ in range(times):
        driver.execute_script("window.scrollBy(0, 300);")
        time.sleep(0.1)

def dismiss_popups(driver):
    try:
        webdriver.ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        time.sleep(0.5)
        buttons = driver.find_elements(By.XPATH, '//div[@aria-label="Close"] | //div[@role="button"]//i')
        if buttons: buttons[0].click()
    except: pass

# ==========================================================
# 🟢 CRAIGSLIST LOGIC
# ==========================================================
def run_craigslist(driver, title, price, description, image_path):
    print("   ... 🟣 [CL] Starting Mission")
    driver.get("https://post.craigslist.org/c/den")
    
    wait = WebDriverWait(driver, 10)

    # 1. Location & Category
    try:
        # Dealer Check
        try: 
            driver.find_element(By.CSS_SELECTOR, 'input[value="fsd"]').click()
            driver.find_element(By.NAME, "go").click()
        except: pass
        
        # Category (Radio #25)
        try:
            radios = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, 'input[type="radio"]')))
            if len(radios) > 24: radios[24].click()
            else: radios[-1].click()
            
            # Watchdog: If url doesn't change, click go
            try: wait.until(EC.url_changes(driver.current_url))
            except: driver.find_element(By.NAME, "go").click()
        except: pass
        
        # Sub-area
        try:
            labels = driver.find_elements(By.TAG_NAME, 'label')
            for label in labels:
                if "city of denver" in label.text.lower(): label.click(); break
            driver.find_element(By.NAME, "go").click()
        except: pass

    except Exception as e: print(f"      ⚠️ Nav Error: {e}")

    # 2. Fill Form
    print("      📝 [CL] Filling Form...")
    try:
        wait.until(EC.presence_of_element_located((By.NAME, "PostingTitle")))
        try:
            email_input = driver.find_element(By.NAME, "FromEMail")
            if not email_input.get_attribute('value'): email_input.send_keys("garagescholars@gmail.com")
        except: pass

        driver.find_element(By.NAME, "PostingTitle").send_keys(title)
        driver.find_element(By.NAME, "price").send_keys(price.replace("$", ""))
        driver.find_element(By.NAME, "postal").send_keys(PAYMENT_INFO['zip'])
        driver.find_element(By.NAME, "PostingBody").send_keys(f"{title}\n\n{description}\n\nPickup Only.")
        
        try:
            driver.find_element(By.NAME, "show_phone_ok").click()
            driver.find_element(By.NAME, "contact_phone").send_keys(PAYMENT_INFO['phone'])
            driver.find_element(By.NAME, "contact_name").send_keys("Garage Scholars")
            driver.find_element(By.NAME, "contact_text_ok").click()
        except: pass

        driver.find_element(By.NAME, "go").click()
    except Exception as e: print(f"      ❌ Form Error: {e}")

    # 3. Map (Skip)
    try: wait.until(EC.presence_of_element_located((By.NAME, "go"))).click()
    except: pass

    # 4. Upload Image (FIXED: Absolute Path)
    print(f"      📸 [CL] Uploading Image: {image_path}")
    try:
        file_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[type="file"]')))
        file_input.send_keys(image_path) 
        time.sleep(5) 
        driver.find_element(By.XPATH, "//button[contains(text(), 'done with images')]").click()
    except Exception as e: print(f"      ❌ Image Error: {e}")

    # 5. Payment (FIXED: Iframe Switch)
    print("      🚀 [CL] Moving to Payment...")
    try:
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button.continue"))).click()
        time.sleep(3)
        
        print("      💳 [CL] Finding Payment Frame...")
        # Switch into the billing iframe
        try:
            billing_frame = wait.until(EC.presence_of_element_located((By.TAG_NAME, "iframe")))
            driver.switch_to.frame(billing_frame) 
            
            # Now fill fields
            driver.find_element(By.NAME, "cardName").send_keys(PAYMENT_INFO['name'])
            driver.find_element(By.NAME, "cardNumber").send_keys(PAYMENT_INFO['cardNumber'])
            driver.find_element(By.NAME, "expMonth").send_keys(PAYMENT_INFO['expMonth'])
            driver.find_element(By.NAME, "expYear").send_keys(PAYMENT_INFO['expYear'])
            driver.find_element(By.NAME, "cvCode").send_keys(PAYMENT_INFO['cvc'])
            driver.find_element(By.NAME, "billingAddress").send_keys(PAYMENT_INFO['address'])
            driver.find_element(By.NAME, "billingCity").send_keys(PAYMENT_INFO['city'])
            driver.find_element(By.NAME, "billingState").send_keys(PAYMENT_INFO['state'])
            driver.find_element(By.NAME, "billingPostal").send_keys(PAYMENT_INFO['zip'])
            
            # Switch back to main page
            driver.switch_to.default_content()
            print("      ✅ [CL] Payment Filled!")
        except:
             print("      ⚠️ Iframe not found, possibly manual review needed.")

    except Exception as e: print(f"      ⚠️ Payment Error: {e}")


# ==========================================================
# 🔵 FACEBOOK LOGIC
# ==========================================================
def run_facebook(driver, title, price, description, image_path):
    print("   ... 🔵 [FB] Starting Mission")
    
    # OPEN NEW TAB for Facebook (Keeps CL open!)
    driver.execute_script("window.open('');")
    driver.switch_to.window(driver.window_handles[-1])
    
    driver.get("https://www.facebook.com/marketplace/create/item")
    time.sleep(4)
    dismiss_popups(driver)

    # 1. Upload Image (FIXED: Absolute Path)
    print(f"      📸 [FB] Uploading Image: {image_path}")
    try:
        # FB input is often hidden, wait for it
        file_input = driver.find_element(By.XPATH, '//input[@type="file"]')
        file_input.send_keys(image_path)
        time.sleep(5)
    except Exception as e: print(f"      ❌ FB Image Error: {e}")

    # 2. Fill Text
    print("      📝 [FB] Filling Details...")
    try:
        def fill_lbl(txt, val):
            try: 
                el = driver.find_element(By.XPATH, f"//label[.//span[contains(text(), '{txt}')]]//input | //label[.//span[contains(text(), '{txt}')]]//textarea")
                el.send_keys(val)
            except: pass
            
        fill_lbl("Title", title)
        fill_lbl("Price", price.replace("$", ""))
        fill_lbl("Description", description)
    except: pass

    # 3. Delivery
    print("      🚚 [FB] Delivery Setup...")
    scroll_down(driver, 5)
    try:
        driver.find_element(By.XPATH, "//div[@aria-label='Next']").click()
    except: pass


# ==========================================================
# 🧠 MAIN PROCESSOR
# ==========================================================
def process_listing(doc_id, data):
    print(f"\n🔔 NEW JOB RECEIVED: {data.get('title')}")
    
    # 1. PREPARE IMAGE (ABSOLUTE PATH FIX)
    image_base64 = data.get('imageUrl')
    image_filename = "temp_image.jpg"
    
    # Create absolute path (Critical for Mac Selenium)
    current_dir = os.getcwd() 
    abs_image_path = os.path.join(current_dir, image_filename)

    if image_base64:
        try:
            clean_code = image_base64.split(",")[1]
            with open(abs_image_path, "wb") as f:
                f.write(base64.b64decode(clean_code))
        except:
            print("   ⚠️ Image decode failed")
            return

    # 2. SETUP CHROME WITH PERSISTENT PROFILE
    chrome_options = Options()
    chrome_options.add_experimental_option("detach", True)
    
    # THIS SAVES YOUR LOGIN!
    chrome_options.add_argument(f"user-data-dir={os.path.join(current_dir, 'chrome_profile')}")

    try:
        driver = webdriver.Chrome(options=chrome_options)
    except Exception as e:
        print(f"❌ CHROME ERROR: {e}\n(Make sure all other Chrome windows are closed!)")
        return

    # 3. RUN MISSIONS
    try:
        if "Craigslist" in data.get('platform', 'Both') or "Both" in data.get('platform'):
            run_craigslist(driver, data.get('title'), data.get('price'), data.get('description'), abs_image_path)
        
        if "FB" in data.get('platform', 'Both') or "Both" in data.get('platform'):
            run_facebook(driver, data.get('title'), data.get('price'), data.get('description'), abs_image_path)

    except Exception as e:
        print(f"❌ CRITICAL ERROR: {e}")
    
    # 4. CLEANUP
    db.collection('inventory').document(doc_id).update({'status': 'Active'})
    print("   ✅ Job Complete. Database Updated.")

# ==========================================================
# 📡 THE WATCHER LOOP
# ==========================================================
while True:
    try:
        docs = db.collection('inventory').where('status', '==', 'Pending').stream()
        for doc in docs:
            process_listing(doc.id, doc.to_dict())
        time.sleep(5)
    except Exception as e:
        print(f"Wait loop error: {e}")
        time.sleep(5)