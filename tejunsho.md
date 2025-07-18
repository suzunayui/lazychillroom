sudo systemctl enable docker

git clone https://github.com/suzunayui/lazychillroom

cd lazychillroom

chmod +x setup.sh

./setup.sh

nano .env

sudo docker compose up --build