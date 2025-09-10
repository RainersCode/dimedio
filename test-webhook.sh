#!/bin/bash

# Test n8n webhook directly
curl -X POST https://elubwea.app.n8n.cloud/webhook-test/b7919a6a-0bf1-4757-9614-423467c2a8b6 \
  -H "Content-Type: application/json" \
  -d '{
    "complaint": "test complaint", 
    "age": 30,
    "gender": "male",
    "symptoms": "",
    "timestamp": "2025-09-09T10:00:00.000Z",
    "user_drug_inventory": [],
    "has_drug_inventory": false
  }'