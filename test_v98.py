import sqlite3

try:
    conn = sqlite3.connect('e:/portfolio/server/database.sqlite')
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = c.fetchall()
    print("Tables:", tables)
except Exception as e:
    print("Error:", e)
