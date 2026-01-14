# How to Run Zakaa Full Application

## Quick Start

### Option 1: Using PowerShell Script (Recommended)
```powershell
.\start_all.ps1
```

### Option 2: Using Batch File
```cmd
start_all.bat
```

### Option 3: Manual Start

#### Terminal 1 - Backend:
```bash
npm start
# or
node server.js
```

#### Terminal 2 - Frontend:
```bash
cd frontend
npm install  # Only needed first time
npm run dev
```

## Access Points

- **Backend API**: http://localhost:3000
- **Frontend Dashboard**: http://localhost:5173

## Login Credentials

You can use any of these test accounts (all passwords are `password123`):

- `burgerking@example.com`
- `pizzahut@example.com`
- `sportscourt@example.com`
- `hairsalon@example.com`
- `cafedelmar@example.com`

## Features Available

### Standard Accounts (sportscourt, hairsalon):
- Dashboard
- Order Management
- Branch Management
- Menu & Item Management
- Settings

### Premium Accounts (burgerking, pizzahut, cafedelmar):
- All Standard features
- **Analytics Dashboard**
- Revenue Reports
- Customer Analytics
- Top Items Reports
- Branch Performance

## Troubleshooting

### Frontend Dependencies Not Installed
If you see errors about missing dependencies:
```bash
cd frontend
npm install
```

### Backend Not Running
Check if port 3000 is available:
```bash
# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000
```

### Disk Space Issues
If you encounter "ENOSPC: no space left on device":
1. Free up disk space
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall if needed

## Development

- Backend auto-reload: Use `npm run dev` instead of `npm start`
- Frontend: Vite HMR (Hot Module Replacement) is enabled by default
