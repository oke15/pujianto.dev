---
title: Setup Auto Backup Database Aplikasi Laravel
description: Panduan lengkap menyiapkan auto backup database Laravel ke S3/R2 dengan spatie/laravel-backup, termasuk jadwal, notifikasi, dan cara testing.
---

# Setup Auto Backup Database Aplikasi Laravel

Backup manual gampang dilupakan. Artikel ini membahas cara menyiapkan **auto backup database** aplikasi Laravel menggunakan package [spatie/laravel-backup](https://spatie.be/docs/laravel-backup), dengan hasil akhir:

- Backup database jalan otomatis setiap hari sesuai jadwal.
- File backup disimpan di storage eksternal (AWS S3 / Cloudflare R2), bukan di server aplikasi.
- Backup lama dibersihkan otomatis supaya biaya storage tidak membengkak.
- Ada notifikasi email (default) dan opsional Discord jika backup gagal atau tidak sehat.

> Asumsi: aplikasi Laravel sudah berjalan di server dengan akses SSH dan cron aktif, serta database MySQL/MariaDB/PostgreSQL.

## 1. Prasyarat

Sebelum mulai, pastikan:

- Laravel versi yang kompatibel dengan `spatie/laravel-backup` (cek [tabel kompatibilitas](https://spatie.be/docs/laravel-backup) di dokumentasi resmi).
- PHP CLI dan ekstensi yang dibutuhkan sudah terpasang.
- Binary dump database tersedia dan bisa diakses user yang menjalankan cron, misalnya:

  ```bash
  which mysqldump   # MySQL / MariaDB
  which pg_dump     # PostgreSQL
  ```

  Jika belum ada, install dulu (`mysql-client` atau `postgresql-client`). Tanpa binary ini, proses dump akan gagal.

- Sudah punya bucket S3-compatible beserta access key-nya.
- Cron server aktif. Jadwal Laravel **tidak akan jalan** tanpa cron.

## 2. Siapkan storage S3-compatible (AWS S3 / Cloudflare R2)

Menyimpan backup di server yang sama berisiko: kalau server hilang, backup ikut hilang. Karena itu backup kita arahkan ke storage eksternal.

### 2.1 Install adapter S3

```bash
composer require league/flysystem-aws-s3-v3
```

### 2.2 Tambahkan disk baru

Edit `config/filesystems.php`, tambahkan disk `r2_backup` (nama bebas, sesuaikan dengan provider yang dipakai):

```php
'r2_backup' => [
    'driver' => 's3',
    'key' => env('R2_BACKUP_ACCESS_KEY_ID'),
    'secret' => env('R2_BACKUP_SECRET_ACCESS_KEY'),
    'region' => env('R2_BACKUP_REGION', 'auto'),
    'bucket' => env('R2_BACKUP_BUCKET'),
    'url' => env('R2_BACKUP_URL'),
    'endpoint' => env('R2_BACKUP_ENDPOINT'),
    'use_path_style_endpoint' => env('R2_BACKUP_USE_PATH_STYLE_ENDPOINT', false),
    'visibility' => env('R2_BACKUP_VISIBILITY', 'private'),
    'retries' => (int) env('R2_BACKUP_RETRIES', 10),
    'http' => [
        'connect_timeout' => 30,
        'timeout' => 600, // upload backup besar butuh waktu
    ],
    'throw' => true, // biarkan error muncul, jangan diam-diam gagal
],
```

### 2.3 Lengkapi variabel `.env`

```dotenv
R2_BACKUP_ACCESS_KEY_ID=
R2_BACKUP_SECRET_ACCESS_KEY=
R2_BACKUP_REGION=auto
R2_BACKUP_BUCKET=backup-db
R2_BACKUP_ENDPOINT=
R2_BACKUP_URL=
R2_BACKUP_USE_PATH_STYLE_ENDPOINT=false
R2_BACKUP_VISIBILITY=private
R2_BACKUP_RETRIES=10
```

Catatan keamanan dan operasional:

- Gunakan bucket **private**, jangan public.
- Buat token/access key khusus backup dengan izin seminimal mungkin (hanya read/write ke bucket backup).
- Untuk Cloudflare R2, endpoint berbentuk `https://<account-id>.r2.cloudflarestorage.com` dan region biasanya `auto`.
- Setelah mengubah `.env` di server, jalankan `php artisan config:clear` (atau `optimize:clear`) agar konfigurasi baru terbaca.

## 3. Install `spatie/laravel-backup`

Ini inti dari setup kita.

### 3.1 Install package

```bash
composer require spatie/laravel-backup
```

### 3.2 Publish config

```bash
php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider" --tag=backup-config
```

Opsional, jika ingin mengubah teks notifikasi:

```bash
php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider" --tag=backup-translations
```

### 3.3 Sesuaikan `config/backup.php`

Tidak semua bagian perlu diubah. Berikut key yang biasanya disesuaikan.

**Format timestamp nama file dump**

```php
'database_dump_file_timestamp_format' => 'Y-m-d-H-i-s',
```

**Ekstensi file hasil dump** (kosongkan untuk default, atau isi `backup`/`sql`)

```php
'database_dump_file_extension' => 'backup',
```

**Prefix nama file**

```php
'destination' => [
    // ...
    'filename_prefix' => env('DB_DATABASE').'_'.env('APP_ENV').'_',
],
```

**Disk tujuan backup** — bisa lebih dari satu:

```php
'destination' => [
    // ...
    'disks' => [
        'r2_backup',
        // 'local',
        // 's3_aws',
    ],
],
```

**Monitoring backup** — sesuaikan nama disk dengan yang dipakai:

```php
'monitor_backups' => [
    [
        'name' => env('APP_NAME', 'laravel-backup'),
        'disks' => ['r2_backup'],
        'health_checks' => [
            MaximumAgeInDays::class => 1,
            MaximumStorageInMegabytes::class => 5000, // 5 GB
        ],
    ],
],
```

Dengan `MaximumAgeInDays` = 1, backup dianggap tidak sehat kalau umur backup terakhir lebih dari 1 hari. Pastikan jadwal backup dan jadwal monitor tidak saling bertabrakan.

**Retensi backup** — supaya storage tidak penuh. Contoh strategi default:

```php
'cleanup' => [
    'strategy' => \Spatie\Backup\Tasks\Cleanup\Strategies\DefaultStrategy::class,
    'default_strategy' => [
        'keep_all_backups_for_days' => 7,
        'keep_daily_backups_for_days' => 16,
        'keep_weekly_backups_for_weeks' => 8,
        'keep_monthly_backups_for_months' => 4,
        'keep_yearly_backups_for_years' => 2,
    ],
],
```

**Email notifikasi** — direkomendasikan memakai env:

```php
'mail' => [
    'to' => env('BACKUP_NOTIFICATION_EMAIL', 'hello@example.com'),

    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
        'name' => env('MAIL_FROM_NAME', 'Example'),
    ],
],
```

> Pastikan konfigurasi mail aplikasi sudah benar. Notifikasi backup memakai mailer yang sama dengan aplikasi.

## 4. Jadwalkan backup otomatis

Tambahkan jadwal di `routes/console.php` (Laravel 11+) atau di `app/Console/Kernel.php` untuk versi sebelumnya:

```php
use Illuminate\Support\Facades\Schedule;

// bersihkan backup lama lebih dulu
Schedule::command('backup:clean')->daily()->at('01:00')->withoutOverlapping();

// backup database saja
Schedule::command('backup:run --only-db')->daily()->at('01:30')->withoutOverlapping();

// cek kesehatan backup setelah proses backup selesai
Schedule::command('backup:monitor')->daily()->at('02:00')->withoutOverlapping();
```

Lalu pastikan cron server memanggil scheduler setiap menit:

```bash
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

Hal yang sering terlewat:

- `at('01:00')` mengikuti timezone aplikasi (`config/app.php` → `timezone`), bukan timezone server.
- Kalau aplikasi berjalan di lebih dari satu server, tambahkan `onOneServer()` agar jadwal tidak jalan dobel.
- `--only-db` hanya mem-backup database. Kalau ingin file upload ikut di-backup, hapus flag tersebut dan atur bagian `source.files`.
- Jangan jalankan `backup:run` bersamaan dengan `backup:clean`; urutannya harus clean dulu, baru backup, baru monitor.

## 5. Notifikasi

Secara default notifikasi dikirim via email sesuai config `mail` di atas.

### 5.1 Opsional: notifikasi ke Discord

Install package pendukung:

```bash
composer require spatie/laravel-discord-alerts
```

Tambahkan webhook Discord di `.env`:

```dotenv
DISCORD_ALERT_WEBHOOK="https://discord.com/api/webhooks/..."
```

Lalu daftarkan channel `discord` di `config/backup.php`:

```php
'discord' => [
    'webhook_url' => env('DISCORD_ALERT_WEBHOOK'),

    /*
     * Jika kosong, nama pada webhook yang dipakai.
     */
    'username' => '',

    /*
     * Jika kosong, avatar pada webhook yang dipakai.
     */
    'avatar_url' => '',
],
```

### 5.2 Aktifkan channel Discord pada notifikasi

Di `config/backup.php` bagian `notifications.notifications`, tambahkan `discord` di setiap event yang ingin dikirim:

```php
use Spatie\Backup\Notifications\Notifications\BackupHasFailedNotification;
use Spatie\Backup\Notifications\Notifications\BackupWasSuccessfulNotification;
use Spatie\Backup\Notifications\Notifications\CleanupHasFailedNotification;
use Spatie\Backup\Notifications\Notifications\CleanupWasSuccessfulNotification;
use Spatie\Backup\Notifications\Notifications\HealthyBackupWasFoundNotification;
use Spatie\Backup\Notifications\Notifications\UnhealthyBackupWasFoundNotification;

// ...

'notifications' => [
    'notifications' => [
        // sebelum
        BackupHasFailedNotification::class => ['mail'], // [!code --]
        UnhealthyBackupWasFoundNotification::class => ['mail'], // [!code --]
        CleanupHasFailedNotification::class => ['mail'], // [!code --]
        BackupWasSuccessfulNotification::class => ['mail'], // [!code --]
        HealthyBackupWasFoundNotification::class => ['mail'], // [!code --]
        CleanupWasSuccessfulNotification::class => ['mail'], // [!code --]

        // sesudah
        BackupHasFailedNotification::class => ['mail', 'discord'], // [!code ++]
        UnhealthyBackupWasFoundNotification::class => ['mail', 'discord'], // [!code ++]
        CleanupHasFailedNotification::class => ['mail', 'discord'], // [!code ++]
        BackupWasSuccessfulNotification::class => ['mail', 'discord'], // [!code ++]
        HealthyBackupWasFoundNotification::class => ['mail', 'discord'], // [!code ++]
        CleanupWasSuccessfulNotification::class => ['mail', 'discord'], // [!code ++]
    ],
],
```

> Kalau notifikasi sukses terasa terlalu berisik, cukup kirim `discord` untuk event gagal (`BackupHasFailedNotification`, `UnhealthyBackupWasFoundNotification`, `CleanupHasFailedNotification`).

Variabel `.env` untuk notifikasi:

```env
BACKUP_NOTIFICATION_EMAIL="your@gmail.com"
DISCORD_ALERT_WEBHOOK="https://discord.com/api/webhooks/..."
```

Jangan lupa `php artisan config:clear` setelah mengubah config/env.

## 6. Testing

Jalankan backup secara manual untuk memastikan semuanya bekerja:

```bash
php artisan backup:run --only-db
```

Kalau berhasil, cek isi bucket dan daftar backup yang dikenali aplikasi:

```bash
php artisan backup:list
php artisan backup:monitor
```

Yang perlu dipastikan:

- File backup muncul di bucket dengan nama sesuai prefix dan timestamp.
- `backup:list` menampilkan backup terbaru.
- `backup:monitor` tidak menghasilkan error (exit code 0).
- Email/Discord notifikasi benar-benar masuk.

### Uji restore (penting)

Backup yang belum pernah di-restore belum bisa disebut backup. Lakukan uji restore di **staging**, jangan di production:

> butuh package : https://github.com/stefanzweifel/laravel-backup-restore

```bash
php artisan backup:restore
```

Command ini akan menanyakan backup dan database tujuan. Setelah restore, cek beberapa tabel utama untuk memastikan datanya utuh. Dokumentasikan langkah restore di catatan internal tim, karena saat insiden biasanya tidak ada waktu untuk menebak-nebak.

## 7. Troubleshooting

| Gejala                                               | Penyebab umum                                           | Solusi                                                            |
| ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `Disk [r2_backup] does not have a configured driver` | Nama disk salah atau config belum di-clear              | Cocokkan nama disk, jalankan `php artisan config:clear`           |
| `mysqldump: not found` / dump gagal                  | Binary database client tidak terpasang                  | Install `mysql-client`/`postgresql-client`, cek `which mysqldump` |
| Upload gagal / timeout                               | File besar, koneksi lambat                              | Naikkan `timeout` dan `connect_timeout`, pertimbangkan kompresi   |
| Notifikasi tidak terkirim                            | Mail config salah, webhook salah                        | Tes mailer aplikasi, cek URL webhook, cek log Laravel             |
| `backup:monitor` melaporkan unhealthy                | Backup terakhir terlalu lama atau storage terlalu besar | Cek jadwal cron, cek `MaximumAgeInDays`, cek `backup:list`        |
| Backup jalan dobel                                   | Scheduler dipanggil dari banyak server                  | Tambahkan `onOneServer()` dan pastikan cache lock terkonfigurasi  |

Cek juga `storage/logs/laravel.log` saat proses backup gagal — biasanya pesan error aslinya ada di sana.

## Checklist sesuai panduan di atas.

- [ ] Bucket S3/R2 dibuat dan bersifat private.
- [ ] Disk `r2_backup` terdaftar di `config/filesystems.php`.
- [ ] `.env` backup terisi dan `config:clear` sudah dijalankan.
- [ ] `spatie/laravel-backup` terpasang dan config sudah dipublish.
- [ ] `disks`, `monitor_backups`, dan `cleanup` sudah disesuaikan.
- [ ] Jadwal backup, clean, dan monitor ada di `routes/console.php`.
- [ ] Cron `schedule:run` aktif di server.
- [ ] Notifikasi email/Discord sudah dites.
- [ ] `backup:run --only-db` dan `backup:list` berhasil.
- [ ] Uji restore di staging berhasil.

Selamat mencoba.

::: tip Orang Bijak Berkata:
_Backup yang baik bukan yang paling canggih, tapi yang rutin jalan dan pernah terbukti bisa di-restore._
:::
