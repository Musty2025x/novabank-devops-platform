variable "aws_region" {
  type    = string
  default = "us-east-1"
}
variable "project_name" {
  type    = string
  default = "novabank-demo"
}
variable "instance_type" {
  type    = string
  default = "t3.small"
}
variable "key_name" {
  description = "Existing AWS key pair name, not the local PEM filename."
  type        = string
}
variable "admin_cidr" {
  description = "Your public IP in CIDR notation, e.g. 203.0.113.10/32."
  type        = string
}
