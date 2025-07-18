#!/bin/bash

# 色付きメッセージ用の関数
print_info() { echo -e "\033[34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[32m[SUCCESS]\033[0m $1"; }
print_warning() { echo -e "\033[33m[WARNING]\033[0m $1"; }
print_error() { echo -e "\033[31m[ERROR]\033[0m $1"; }

# 使用方法
usage() {
    echo "ポート停止スクリプト"
    echo ""
    echo "使用方法:"
    echo "  $0 [port] [options]"
    echo ""
    echo "Parameters:"
    echo "  port    - 停止するポート番号 [デフォルト: 80]"
    echo ""
    echo "Options:"
    echo "  -f, --force     - 確認なしで強制停止"
    echo "  -s, --signal    - 送信するシグナル [デフォルト: TERM]"
    echo "  -h, --help      - このヘルプを表示"
    echo ""
    echo "例:"
    echo "  $0              # ポート80を停止"
    echo "  $0 443          # ポート443を停止"
    echo "  $0 80 -f        # ポート80を強制停止"
    echo "  $0 80 -s KILL   # ポート80をSIGKILLで停止"
}

# デフォルト値
PORT=80
FORCE=false
SIGNAL=TERM

# パラメータ解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -s|--signal)
            SIGNAL="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            print_error "無効なオプション: $1"
            usage
            exit 1
            ;;
        *)
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                PORT="$1"
            else
                print_error "無効なポート番号: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

print_info "ポート$PORTを使用しているプロセスを確認中..."

# ポートを使用しているプロセスの確認
if ! command -v lsof > /dev/null 2>&1; then
    print_error "lsofコマンドが見つかりません"
    print_info "インストールしてください: sudo apt install lsof"
    exit 1
fi

# ポートの使用状況確認
PROCESSES=$(sudo lsof -i :$PORT 2>/dev/null)

if [ -z "$PROCESSES" ]; then
    print_success "ポート$PORTを使用しているプロセスはありません"
    exit 0
fi

print_warning "ポート$PORTを使用しているプロセス:"
echo "$PROCESSES"
echo ""

# プロセスIDを取得
PIDS=$(sudo lsof -ti :$PORT)

if [ -z "$PIDS" ]; then
    print_success "停止するプロセスはありません"
    exit 0
fi

# 確認（強制モードでない場合）
if [ "$FORCE" = false ]; then
    print_info "これらのプロセスを停止しますか？ [y/N]"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "処理を中断しました"
        exit 0
    fi
fi

# Podmanコンテナを優先的に処理
print_info "Podmanコンテナを確認中..."
CONTAINERS=$(podman ps --filter "publish=$PORT" -q 2>/dev/null)

if [ ! -z "$CONTAINERS" ]; then
    print_info "ポート$PORTを使用しているPodmanコンテナを停止中..."
    echo "$CONTAINERS" | xargs -r podman stop
    print_success "Podmanコンテナを停止しました"
    
    # コンテナ停止後にプロセス再確認
    sleep 1
    PIDS=$(sudo lsof -ti :$PORT)
fi

# Dockerコンテナも確認
if command -v docker > /dev/null 2>&1; then
    DOCKER_CONTAINERS=$(sudo docker ps --filter "publish=$PORT" -q 2>/dev/null)
    if [ ! -z "$DOCKER_CONTAINERS" ]; then
        print_info "ポート$PORTを使用しているDockerコンテナを停止中..."
        echo "$DOCKER_CONTAINERS" | xargs -r sudo docker stop
        print_success "Dockerコンテナを停止しました"
        
        # コンテナ停止後にプロセス再確認
        sleep 1
        PIDS=$(sudo lsof -ti :$PORT)
    fi
fi

# 残りのプロセスを停止
if [ ! -z "$PIDS" ]; then
    print_info "プロセスを停止中（シグナル: $SIGNAL）..."
    
    # シグナル送信
    for pid in $PIDS; do
        if kill -0 $pid 2>/dev/null; then
            print_info "PID $pid を停止中..."
            sudo kill -$SIGNAL $pid 2>/dev/null || true
        fi
    done
    
    # TERMシグナルの場合は少し待ってから強制終了を試行
    if [ "$SIGNAL" = "TERM" ]; then
        sleep 3
        
        # まだ残っているプロセスがあるか確認
        REMAINING_PIDS=$(sudo lsof -ti :$PORT)
        if [ ! -z "$REMAINING_PIDS" ]; then
            print_warning "一部のプロセスが残っています。強制終了します..."
            for pid in $REMAINING_PIDS; do
                if kill -0 $pid 2>/dev/null; then
                    print_info "PID $pid を強制終了中..."
                    sudo kill -KILL $pid 2>/dev/null || true
                fi
            done
        fi
    fi
    
    print_success "プロセスの停止処理が完了しました"
else
    print_success "停止するプロセスはありませんでした"
fi

# 最終確認
sleep 1
FINAL_CHECK=$(sudo lsof -ti :$PORT)

if [ -z "$FINAL_CHECK" ]; then
    print_success "🎉 ポート$PORTが正常に空きました！"
    exit 0
else
    print_error "❌ 一部のプロセスが残っています:"
    sudo lsof -i :$PORT
    print_info "手動で停止してください: sudo kill -9 $FINAL_CHECK"
    exit 1
fi
