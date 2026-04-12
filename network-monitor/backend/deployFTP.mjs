import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = `
    apt-get update
    export DEBIAN_FRONTEND=noninteractive
    apt-get install -y vsftpd
    useradd -m mikrotik || true
    echo "mikrotik:backup_spn" | chpasswd
    mkdir -p /home/mikrotik/backups
    chown mikrotik:mikrotik /home/mikrotik/backups
    chmod 777 /home/mikrotik/backups
    
    cat > /etc/vsftpd.conf << 'EOF'
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
allow_writeable_chroot=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
rsa_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
rsa_private_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
ssl_enable=NO
EOF

    systemctl restart vsftpd
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).on('error', (err) => {
  console.log('SSH Error:', err);
}).connect({
  host: '217.216.86.231',
  port: 22,
  username: 'root',
  password: 'suporte10025',
  readyTimeout: 10000
});
