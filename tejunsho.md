rm -rf lazychillroom

git clone https://github.com/suzunayui/lazychillroom

cd lazychillroom

cp .env.example .env

nano .env
ドメインだけ書く

chmod +x setup.sh

./setup.sh

sudo docker compose down -v

sudo docker system df && sudo docker system prune

sudo supervisorctl shutdown
supervisord -c supervisord.conf
supervisorctl status

sudo docker compose up --build

sudo docker compose logs backend