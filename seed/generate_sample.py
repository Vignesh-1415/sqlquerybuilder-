"""
Regenerates seed/sample.sqlite — a small demo database used by the
"Use the sample database" button and by the test cases in the README.

Usage:
    python3 seed/generate_sample.py

Requires only the Python standard library (sqlite3).
"""

import os
import random
import sqlite3
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "sample.sqlite")


def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.executescript(
        """
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            country TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        );

        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL REFERENCES customers(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            total REAL NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX idx_orders_customer ON orders(customer_id);
        CREATE INDEX idx_orders_product ON orders(product_id);
        """
    )

    customers = [
        ("Priya Nair", "priya@example.com", "India"),
        ("Marcus Tan", "marcus@example.com", "Singapore"),
        ("Elena Ruiz", "elena@example.com", "Spain"),
        ("Devon Kim", "devon@example.com", "USA"),
        ("Aisha Bello", "aisha@example.com", "Nigeria"),
        ("Liam O'Connor", "liam@example.com", "Ireland"),
    ]
    cur.executemany("INSERT INTO customers (name, email, country) VALUES (?, ?, ?)", customers)

    products = [
        ("Wireless Mouse", "Accessories", 19.99),
        ("Mechanical Keyboard", "Accessories", 89.50),
        ("27in Monitor", "Displays", 249.00),
        ("USB-C Hub", "Accessories", 34.99),
        ("Laptop Stand", "Accessories", 29.00),
        ("Webcam 1080p", "Peripherals", 45.00),
    ]
    cur.executemany("INSERT INTO products (name, category, price) VALUES (?, ?, ?)", products)

    random.seed(42)  # deterministic output, so the seed file is reproducible
    orders = []
    base = datetime(2026, 4, 1)
    for _ in range(40):
        customer_id = random.randint(1, len(customers))
        product_id = random.randint(1, len(products))
        quantity = random.randint(1, 3)
        price = products[product_id - 1][2]
        total = round(price * quantity, 2)
        created = base + timedelta(days=random.randint(0, 100))
        orders.append((customer_id, product_id, quantity, total, created.strftime("%Y-%m-%d %H:%M:%S")))

    cur.executemany(
        "INSERT INTO orders (customer_id, product_id, quantity, total, created_at) VALUES (?, ?, ?, ?, ?)",
        orders,
    )

    conn.commit()
    conn.close()
    print(f"Created {DB_PATH} ({os.path.getsize(DB_PATH)} bytes)")


if __name__ == "__main__":
    main()
