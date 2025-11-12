set -euo pipefail


PROJECT_DIR="/var/www/boletin"
SERVICE_NAME="boletin-backend"
NODE_VERSION="16"
APP_USER="www-data"

echo "Creating project dir: $PROJECT_DIR"
sudo mkdir -p "$PROJECT_DIR"
sudo chown $USER:$USER "$PROJECT_DIR"

echo "Copy project files into $PROJECT_DIR (assumes you ran this from project root)"
rsync -av --exclude node_modules --exclude .git ./ "$PROJECT_DIR/"

echo "Installing Node.js and build tools"

curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

cd "$PROJECT_DIR"

echo "Installing npm dependencies"
npm install --production

echo "Make start script executable"
sudo chown $USER:$USER start_server.sh
chmod +x start_server.sh


SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
sudo tee "$SERVICE_FILE" > /dev/null <<'EOF'
[Unit]
Description=Boletin Backend Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/boletin
EnvironmentFile=/var/www/boletin/.env
ExecStart=/usr/bin/node /var/www/boletin/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd and starting service"
sudo systemctl daemon-reload
sudo systemctl enable --now $SERVICE_NAME
sudo systemctl status $SERVICE_NAME --no-pager

echo "Deployment complete. Visit http://<VM_IP>:3000 to access the app (ensure firewall rules allow it)."
