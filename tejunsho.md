rm -rf lazychillroom

git clone https://github.com/suzunayui/lazychillroom

cd lazychillroom

cp .env.example .env

nano .env
ドメインだけ書く

chmod +x setup.sh

./setup.sh

nano .env

sudo docker compose up --build