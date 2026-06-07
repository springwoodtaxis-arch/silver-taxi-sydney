# Twilio IVR Updates for Silver Taxi Sydney

## Overview

This document outlines the updates made to the Silver Taxi Sydney Twilio IVR system, including two new call flow versions and updated branding/messaging.

## Key Changes

### 1. Branding Updates

All greetings and messages have been updated from "Silver Service Taxi" to **"Silver Taxi Sydney"** across:
- All HTML pages in `/public/`
- Server-side messages in `server.js`
- Both Twilio IVR flow versions

### 2. Lost Property Messaging

All references to "General Enquiry" or "property/general" have been replaced with **"For lost property"** with direct reference to the lost property hotline: **1 3 1 0 0 8**

Updated in:
- Contact form (`contact.html`) - enquiry type dropdown and contextual banners
- Server-side enquiry labels (`server.js`)
- All Twilio IVR greetings and messages

### 3. Confirmation Logic

Both IVR versions now implement **single confirmation** after:
- **Google Maps location verification** - pickup and dropoff addresses are validated
- **Fare calculation** - price is calculated and confirmed with the caller before proceeding

## Twilio IVR Versions

### Version 1: Standard IVR (`twilio-ivr-v1-standard.json`)

**Features:**
- Traditional phone-based booking flow
- Caller speaks/enters: pickup, dropoff, date, time, vehicle type, name, phone
- Confirmation step before booking submission
- Fallback to SMS link if team unavailable
- After-hours handling with SMS booking link

**Flow:**
1. Check business hours
2. Welcome greeting (updated to "Silver Taxi Sydney")
3. Attempt to connect to agent
4. If unavailable: IVR booking flow
5. Collect all booking details via speech/DTMF
6. Single confirmation prompt (after all details collected)
7. Submit booking via HTTP POST to `/api/booking`
8. Send SMS confirmation

**Key Endpoints:**
- `GET /api/check-hours` - Check if business is open
- `POST /api/booking` - Create booking from voice data

---

### Version 2: Fully Automated AI Call Flow (`twilio-ivr-v2-ai-automated.json`)

**Features:**
- **Fully automated** - no agent connection required
- **Real-time location verification** via Google Maps API
- **Instant fare calculation** with caller confirmation
- **Single confirmation** after Google location + price verification
- AI-driven conversation with natural speech recognition
- Automatic booking creation upon confirmation

**Flow:**
1. Check business hours
2. AI welcome greeting
3. Collect pickup address → **Verify with Google Maps**
4. Collect dropoff address → **Verify with Google Maps**
5. **Calculate fare** → **Confirm fare with caller (Press 1 to confirm, 2 to cancel)**
6. If confirmed: collect date, time, name, phone
7. Final confirmation of all details
8. Submit booking via HTTP POST to `/api/booking`
9. Send SMS confirmation

**Key Endpoints:**
- `GET /api/check-hours` - Check if business is open
- `POST /api/verify-location` - Verify address with Google Maps
- `POST /api/fare` - Calculate fare for route
- `POST /api/booking` - Create booking from voice data

**Advantages:**
- **Faster booking** - no agent wait time
- **Automatic verification** - reduces booking errors
- **Price transparency** - customer knows cost before confirming
- **Reduced abandonment** - instant confirmation after verification

---

## Implementation Notes

### Required API Endpoints

Both IVR flows require the following backend endpoints to be implemented:

#### 1. Location Verification
```
POST /api/verify-location
Request: { address: "string" }
Response: { success: true, lat: number, lng: number, formatted: "string" }
```

#### 2. Fare Calculation
```
POST /api/fare
Request: { pickup: "string", dropoff: "string", vehicle: "string" }
Response: { total: number, sub: number, tolls: number, km: number }
```

#### 3. Booking Creation
```
POST /api/booking
Request: { name, phone, pickup, dropoff, date, time, vehicle, bookingRef, site }
Response: { success: true, ref: "string" }
```

### Deployment Steps

1. **Choose IVR Version:**
   - Use V1 (Standard) if you want agent escalation with IVR fallback
   - Use V2 (AI Automated) for fully automated bookings

2. **Import to Twilio Studio:**
   - Log in to Twilio Console
   - Navigate to Studio → Create New Flow
   - Import the JSON from either `twilio-ivr-v1-standard.json` or `twilio-ivr-v2-ai-automated.json`
   - Update the HTTP request URLs to point to your production server

3. **Update Configuration:**
   - Set Twilio phone number to trigger the flow
   - Configure after-hours hours in `/api/check-hours` endpoint
   - Ensure Google Maps API key is configured for location verification

4. **Test:**
   - Call the Twilio number and test both booking paths
   - Verify SMS confirmations are sent
   - Check booking records in MongoDB

### Messaging Updates Summary

| Component | Old | New |
|-----------|-----|-----|
| Greeting | "Silver Service Taxi" | "Silver Taxi Sydney" |
| Lost Property | "General Enquiry" | "For lost property" |
| Lost Property Number | N/A | 1 3 1 0 0 8 |
| Contact Form Option | "General Enquiry" | "For lost property" |
| SMS Messages | "Sydney's Premium Transport" | "Silver Taxi Sydney" |

### Files Modified

- `public/*.html` - All HTML files updated with new branding
- `server.js` - Updated greetings, SMS messages, enquiry labels
- `public/contact.html` - Updated contact form with lost property option
- `twilio-ivr-v1-standard.json` - NEW - Standard IVR flow
- `twilio-ivr-v2-ai-automated.json` - NEW - Fully automated AI flow

### Testing Checklist

- [ ] After-hours message displays correctly
- [ ] Business hours message displays correctly
- [ ] Pickup address verification works
- [ ] Dropoff address verification works
- [ ] Fare calculation displays correctly
- [ ] Confirmation prompt appears after fare
- [ ] Booking submission succeeds
- [ ] SMS confirmation sent to customer
- [ ] Contact form shows "For lost property" option
- [ ] Lost property banner displays correct information

---

## Support

For issues or questions about the Twilio IVR implementation:
1. Check Twilio Studio logs for flow execution errors
2. Verify backend API endpoints are responding correctly
3. Check MongoDB for booking records
4. Review SMS delivery logs in Twilio Console

---

**Last Updated:** May 20, 2026
**Version:** 2.0
**Status:** Ready for Deployment
