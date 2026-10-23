output "instance_public_ip" {
  value = aws_instance.app.public_ip
}
output "application_url" {
  value = "http://${aws_instance.app.public_ip}:8080"
}
