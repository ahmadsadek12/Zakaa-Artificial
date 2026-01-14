# Branch Creation Debugging

## Required Fields

When creating a branch via `POST /api/businesses/me/branches`, you need:

```json
{
  "branchName": "Branch Name Here",  // REQUIRED - must not be empty
  "location": {                       // REQUIRED - must be an object
    "city": "City Name",              // REQUIRED - must not be empty
    "street": "Street Address",       // REQUIRED - must not be empty
    "building": "Building Name",      // Optional
    "floor": "Floor Number"           // Optional
  },
  "contactPhoneNumber": "+961...",    // Optional - must be valid phone if provided
  "whatsappPhoneNumber": "+961...",   // Optional - must be valid phone if provided
  "whatsappPhoneNumberId": "...",     // Optional
  "whatsappAccessToken": "..."        // Optional
}
```

## Common Errors

### 400 Bad Request - Validation Failed

This means one or more required fields are missing or invalid.

**Check the response body for details:**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "errors": [
      {
        "field": "branchName",
        "message": "Branch name is required",
        "value": ""
      },
      {
        "field": "location.city",
        "message": "City is required",
        "value": ""
      }
    ]
  }
}
```

## Debugging Steps

1. **Check Browser Console** - Look at the Network tab → Response to see exact error messages
2. **Check Server Logs** - Look for validation errors in server console
3. **Verify Request Payload** - Check what data is being sent in the Request Payload

## Testing with cURL

```bash
curl -X POST http://localhost:3000/api/businesses/me/branches \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "branchName": "Test Branch",
    "location": {
      "city": "Beirut",
      "street": "Hamra Street"
    }
  }'
```
