# Seed data

`sample.sqlite` is a small demo database (customers, products, orders) used
by:
- the "Use the sample database" button in the frontend (a copy lives at
  `client/assets/sample.sqlite`)
- the manual test cases in the root `README.md`

Regenerate it any time with:
```bash
python3 seed/generate_sample.py
cp seed/sample.sqlite ../client/assets/sample.sqlite   # keep the frontend copy in sync
```
The script is deterministic (seeded RNG), so it always produces the same
32KB file — safe to commit to version control as test fixture data.
