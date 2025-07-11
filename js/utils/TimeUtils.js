// 時刻関連のユーティリティ関数
class TimeUtils {
    // 日本時間でのタイムスタンプフォーマット
    static formatTimestamp(dateString) {
        const messageDate = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
        
        const options = {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit'
        };

        // 今日のメッセージの場合は時刻のみ
        if (messageDay.getTime() === today.getTime()) {
            return messageDate.toLocaleTimeString('ja-JP', options);
        }
        
        // 昨日のメッセージ
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (messageDay.getTime() === yesterday.getTime()) {
            return '昨日 ' + messageDate.toLocaleTimeString('ja-JP', options);
        }
        
        // それ以外は日付と時刻
        return messageDate.toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            month: 'numeric',
            day: 'numeric'
        }) + ' ' + messageDate.toLocaleTimeString('ja-JP', options);
    }

    // 現在時刻を日本時間で取得
    static getCurrentJSTTime() {
        return new Date().toLocaleTimeString('ja-JP', {
            timeZone: 'Asia/Tokyo',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// グローバルスコープに登録
window.TimeUtils = TimeUtils;
