---
title: Setup Auto Backup Database Aplikasi Laravel
description: Panduan deploy auto backup database aplikasi laravel
---

# Setup Auto Backup Database Aplikasi Laravel

Berikut alur proses setup auto backup **database** aplikasi laravel menggunakan package [spatie/laravel-backup](https://spatie.be/docs/laravel-backup).

## 1. Siapkan storage S3 atau sejenisnya

- Gunakan layanan storage eksternal seperti AWS S3 atau Cloudflare R2.
- Install package `league/flysystem-aws-s3-v3`
  ```
  composer require league/flysystem-aws-s3-v3
  ```
- Siapkan pilihan disk baru pada `config/filesystems.php`, bisa diberikan nama `r2_backup`.
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
              'timeout' => 600,
          ],
          'throw' => true,
      ],
  ```

## 2. Install `spatie/laravel-backup`

Ini poin pentingnya.

- install package, dengan run:

  ```bash
  composer require spatie/laravel-backup
  ```

- publish config dengan run:

  ```bash
  php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider" --tag=backup-config
  ```

- untuk terjemahan notifikasi backup, bisa publish dengan run (**opsional**):

  ```bash
  php artisan vendor:publish --provider="Spatie\Backup\BackupServiceProvider" --tag=backup-translations
  ```

Sesuaikan `config/backup.php`, edit yang dibutuhkan saja, berikut beberapa config key yang dibutuhkan untuk penyesuaian.

- timestamp file dump

  ```php
  'database_dump_file_timestamp_format' => 'Y-m-d-H-i-s'
  ```

- extenstion file hasil dump

  ```php
  'database_dump_file_extension' => 'backup',
  ```

- prefix file

  ```php
  'filename_prefix' => env('DB_DATABASE').'_'.env('APP_ENV').'_'
  ```

- disk, tempat dimana backup akan disimpan, bisa multi disk.

  ```php
  'disks' => [
              'r2_backup',
              //local,
              //s3_aws
          ],
  ```

- Monitoring Backup, sesuaikan disknya.

  ```php
  'monitor_backups' => [
      [
          'name' => env('APP_NAME', 'laravel-backup'),
          'disks' => ['r2_backup'], //  [!code warning]
          'health_checks' => [
              MaximumAgeInDays::class => 1,
              MaximumStorageInMegabytes::class => 5000, // 5GB
          ],
      ],
  ],
  ```

- Notifikasi via email (default), direkomendasikan pakai env value.

  ```php
  'mail' => [
          'to' => env('BACKUP_NOTIFICATION_EMAIL', 'hello@example.com'), //  [!code warning]

          'from' => [
              'address' => env('MAIL_FROM_ADDRESS', 'hello@example.com'),
              'name' => env('MAIL_FROM_NAME', 'Example'),
          ],
      ],
  ```

Tambahkan route di `routes/console.php`

```php
// backup database
Schedule::command('backup:clean')->daily()->at('01:00')->withoutOverlapping();
Schedule::command('backup:run --only-db')->daily()->at('01:30')->withoutOverlapping();
Schedule::command('backup:monitor')->daily()->at('02:00')->withoutOverlapping();
```

Testing **local** run:

```php
php artisan backup:run --only-db
```

## 3. Notifikasi

- Secara default notifikasi via email, melalui config `mail`.
- Opsional, tambahkan channel `discord` dengan install package [spatie/laravel-discord-alerts](https://github.com/spatie/laravel-discord-alerts).

  ```php
  composer require spatie/laravel-discord-alerts
  ```

- setup variable `DISCORD_ALERT_WEBHOOK` pada .env, isinya berupa `webhook_url` dari aplikasi discord.
- setup channel `discord` pada `config/backup.php`.

  ````php
  'discord' => [
          'webhook_url' => env('DISCORD_ALERT_WEBHOOK'), //  [!code warning]
          /*
           * If this is an empty string, the name field on the webhook will be used.
           */
          'username' => '',

          /*
           * If this is an empty string, the avatar on the webhook will be used.
           */
          'avatar_url' => '',
      ],
      ```
  ````

- tambahkan channel notifikasi `discord`

```php
'notifications' => [
        'notifications' => [
            // config lama
            BackupHasFailedNotification::class => ['mail'], // [!code --]
            UnhealthyBackupWasFoundNotification::class => ['mail'], // [!code --]
            CleanupHasFailedNotification::class => ['mail'], // [!code --]
            BackupWasSuccessfulNotification::class => ['mail'], // [!code --]
            HealthyBackupWasFoundNotification::class => ['mail'],// [!code --]
            CleanupWasSuccessfulNotification::class => ['mail'], // [!code --]
            // sesuaikan menjadi:
            BackupHasFailedNotification::class => ['mail', 'discord'], // [!code ++]
            UnhealthyBackupWasFoundNotification::class => ['mail', 'discord'], // [!code ++]
            CleanupHasFailedNotification::class => ['mail', 'discord'], // [!code ++]
            BackupWasSuccessfulNotification::class => ['mail', 'discord'], // [!code ++]
            HealthyBackupWasFoundNotification::class => ['mail', 'discord'],// [!code ++]
            CleanupWasSuccessfulNotification::class => ['mail', 'discord'], // [!code ++]
        ],
]
```

Selamat mencoba.
