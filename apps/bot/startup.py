import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

from main import app_bot, SECRET

async def register():
    app_url = os.environ.get("RENDER_EXTERNAL_URL", "")
    if not app_url:
        print("RENDER_EXTERNAL_URL tidak diset")
        return
    url = f"{app_url}/webhook/{SECRET}"
    await app_bot.initialize()
    await app_bot.bot.set_webhook(url=url, allowed_updates=["message", "callback_query"])
    print(f"Webhook registered: {url}")

asyncio.run(register())