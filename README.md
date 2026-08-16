DB ARCHITECTURE:
Edge Function
│
authenticate user
│
▼
user's JWT
│
▼
Supabase DB
│
┌─────┴─────┐
│ │
GRANT RLS
│ │
▼ ▼
table user's rows
access only
