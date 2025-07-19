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

# Dockerコンテナが起動したら、個別にログを確認
supervisorctl stop docker-logs
sleep 30  # コンテナ起動を待つ
supervisorctl start docker-logs

sudo docker compose logs backend


curl -sSL https://get.docker.com/ | sh
sudo usermod -aG docker $USER