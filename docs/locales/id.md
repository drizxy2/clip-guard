# Clip Guard

Clip Guard adalah ekstensi browser eksperimental yang memperingatkan perintah shell mencurigakan sebelum ditulis ke papan klip atau ditempelkan ke halaman. Heuristiknya dapat menghasilkan positif palsu atau melewatkan ancaman; ekstensi ini bukan pengganti perlindungan sistem operasi.

## Instalasi

Unduh dan ekstrak [rilis terbaru](https://github.com/drizxy2/clip-guard/releases).

- **Chrome, Edge, Brave, dan browser Chromium lainnya:** buka `chrome://extensions` atau `edge://extensions`, aktifkan Developer mode, pilih **Load unpacked**, lalu pilih folder hasil ekstrak yang berisi `manifest.json`.
- **Firefox:** sampai add-on ditandatangani dan diterbitkan di AMO, muat sementara melalui `about:debugging#/runtime/this-firefox` dengan memilih `manifest.json` hasil ekstrak. Add-on sementara dihapus saat Firefox ditutup.

## Perlindungan dan privasi

Mode blokir menghentikan penulisan atau penempelan mencurigakan sampai Anda memutuskan. Mode peringatan saja mengizinkan tindakan dan menampilkan peringatan. Clip Guard tidak membuat permintaan jaringan dan tidak pernah menyimpan teks papan klip. Jika pengukuran lokal opsional diaktifkan, hanya asal, tingkat, alasan, dan tanggal yang dicatat. Teks yang menunggu keputusan Anda disimpan sementara di memori.

Antarmuka mengikuti bahasa browser. Lihat [README proyek](../../README.md) untuk detail teknis.
