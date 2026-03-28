# Linux Deployment Guide

Complete guide for deploying JGA Enterprise OS on Linux (Ubuntu 20.04 LTS / 22.04 LTS).

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04 LTS or 22.04 LTS
- **CPU**: 4 cores (8+ recommended for production)
- **RAM**: 8 GB minimum (16 GB recommended)
- **Storage**: 50 GB SSD minimum (100 GB recommended)
- **Network**: Static IP address, ports 80, 443, 3000 accessible

### User Permissions

```bash
# Create dedicated user for JGA OS
sudo useradd -m -s /bin/bash jga-os
sudo usermod -aG docker jga-os
sudo usermod -aG sudo jga-os
```

## Step 1: Install Dependencies

### Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Install Node.js (v18+ or v20+)

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs npm

# Verify installation
node --version
npm --version
```

### Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

### Install PostgreSQL Client Tools

```bash
sudo apt install -y postgresql-client
```

### Install Git

```bash
sudo apt install -y git
```

### Install Required Tools

```bash
sudo apt install -y \
  build-essential \
  curl \
  wget \
  tmux \
  htop \
  net-tools \
  openssl
```

## Step 2: Clone Repository

```bash
cd /home/jga-os
git clone https://github.com/yourusername/jga-enterprise-os.git
cd jga-enterprise-os
sudo chown -R jga-os:jga-os .
```

## Step 3: Configure Environment

### Create .env File

```bash
cp .env.example .env
nano .env
```

**Important environment variables:**

```bash
# Node Environment
NODE_ENV=production
LOG_LEVEL=info

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=jga_enterprise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Redis
REDIS_URL=redis://default:YOUR_REDIS_PASSWORD@redis:6379

# Supabase
SUPABASE_URL=https://your-instance.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# JWT
JWT_SECRET=YOUR_STRONG_JWT_SECRET_HERE

# Application
PORT=3000
HOSTNAME=0.0.0.0
DOMAIN=yourdomain.com

# TLS/SSL
TLS_KEY=/etc/letsencrypt/live/yourdomain.com/privkey.pem
TLS_CERT=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

### Secure .env File

```bash
chmod 600 /home/jga-os/jga-enterprise-os/.env
```

## Step 4: Install SSL/TLS Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate (replace yourdomain.com)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Step 5: Setup Nginx Reverse Proxy

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/jga-os
```

**Configuration:**

```nginx
upstream jga_app {
    server 127.0.0.1:3000;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxying
    location / {
        proxy_pass http://jga_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://jga_app;
    }
}
```

### Enable Configuration

```bash
sudo ln -s /etc/nginx/sites-available/jga-os /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 6: Setup Systemd Service

Create systemd service file:

```bash
sudo nano /etc/systemd/system/jga-os.service
```

**Service file:**

```ini
[Unit]
Description=JGA Enterprise OS Application
After=network.target docker.service
Requires=docker.service

[Service]
Type=notify
User=jga-os
WorkingDirectory=/home/jga-os/jga-enterprise-os
EnvironmentFile=/home/jga-os/jga-enterprise-os/.env

# Start command
ExecStart=/usr/local/bin/docker-compose up

# Restart policy
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Stop command
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
```

### Enable Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable jga-os.service
sudo systemctl start jga-os.service

# Check status
sudo systemctl status jga-os.service
sudo journalctl -u jga-os -f
```

## Step 7: Initialize Database

```bash
cd /home/jga-os/jga-enterprise-os

# Build containers
docker-compose build

# Start services
docker-compose up -d

# Run migrations
docker-compose run --rm migrations

# Seed demo data
docker-compose exec postgres psql -U postgres -d jga_enterprise -f /docker-entrypoint-initdb.d/seed.sql
```

## Step 8: Configure Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3000/tcp    # Application (if direct access needed)
sudo ufw enable
```

## Step 9: Setup Monitoring

### Install Node Exporter (Prometheus)

```bash
# Download and install
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xzf node_exporter-1.6.1.linux-amd64.tar.gz
sudo mv node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
sudo useradd --no-create-home --shell /bin/false node_exporter

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable node_exporter
sudo systemctl start node_exporter
```

### Setup Log Rotation

```bash
sudo tee /etc/logrotate.d/jga-os > /dev/null <<EOF
/home/jga-os/jga-enterprise-os/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 jga-os jga-os
    sharedscripts
}
EOF
```

## Step 10: Database Backups

### Automated Daily Backup

```bash
sudo tee /usr/local/bin/backup-jga-db.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/jga-os/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

docker-compose exec -T postgres pg_dump -U postgres jga_enterprise | \
  gzip > $BACKUP_DIR/jga_enterprise_$TIMESTAMP.sql.gz

# Keep last 30 days
find $BACKUP_DIR -name "jga_enterprise_*.sql.gz" -mtime +30 -delete
EOF

sudo chmod +x /usr/local/bin/backup-jga-db.sh

# Add to crontab
(sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-jga-db.sh") | sudo crontab -
```

## Verification & Testing

### Test Application

```bash
# Wait for start
sleep 30

# Check health endpoint
curl -k https://yourdomain.com/health

# Check logs
sudo journalctl -u jga-os -n 50
docker-compose logs -f app
```

### Verify TLS/SSL

```bash
# Test SSL certificate
openssl s_client -connect yourdomain.com:443

# Or use online tools
curl -I https://yourdomain.com
```

### Check Database Connectivity

```bash
docker-compose exec postgres psql -U postgres -d jga_enterprise -c "\dt"
```

## Troubleshooting

### Containers Won't Start

```bash
# Check Docker status
sudo systemctl status docker

# View container logs
docker-compose logs -f

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Port Already in Use

```bash
# Find what's using the port
sudo lsof -i :3000
sudo lsof -i :5432

# Kill process if needed
sudo kill -9 <PID>
```

### SSL Certificate Issues

```bash
# Renew manually
sudo certbot renew --force-renewal

# Check certificate validity
sudo certbot certificates
```

### Database Connection Issues

```bash
# Test connection
docker-compose exec postgres psql -U postgres -c "SELECT 1;"

# Check environment variables
docker-compose exec app env | grep DATABASE
```

## Upgrade Path

### Update Application

```bash
cd /home/jga-os/jga-enterprise-os
git pull origin main
npm install
docker-compose build
sudo systemctl restart jga-os.service
```

### Database Migrations

```bash
# Create backup first
/usr/local/bin/backup-jga-db.sh

# Run migrations
docker-compose run --rm migrations up
```

## Production Checklist

- [ ] System updated (`apt update && apt upgrade`)
- [ ] Node.js and npm installed and verified
- [ ] Docker and Docker Compose installed
- [ ] SSL/TLS certificates installed (Let's Encrypt)
- [ ] Nginx configured and tested
- [ ] Environment variables configured and secured
- [ ] Systemd service configured and enabled
- [ ] Database initialized and seeded
- [ ] Firewall configured
- [ ] Backups scheduled
- [ ] Health endpoints responding
- [ ] Logs being captured
- [ ] Monitoring configured

## Support Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Last Updated:** March 2026
