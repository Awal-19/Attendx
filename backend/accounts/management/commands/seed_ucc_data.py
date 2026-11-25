from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from accounts.models import User
from students.models import StudentProfile
from lecturers.models import LecturerProfile
from academics.models import (
    Department,
    Programme,
    AcademicYear,
    Semester,
    Course,
    CourseEnrollment,
)
from attendance.models import AttendanceSession, QRToken, AttendanceRecord, AuditLog
from notifications.models import Notification


class Command(BaseCommand):
    help = "Seeds University of Cape Coast (UCC) academic data, users, courses, sessions, and attendance records."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Seeding AttendX – University of Cape Coast (UCC) database...")

        # 1. Academic Year & Semesters
        acad_year, _ = AcademicYear.objects.get_or_create(
            name="2026/2027",
            defaults={
                "start_date": date(2026, 9, 1),
                "end_date": date(2027, 7, 30),
                "is_current": True,
            },
        )
        AcademicYear.objects.get_or_create(
            name="2025/2026",
            defaults={
                "start_date": date(2025, 9, 1),
                "end_date": date(2026, 7, 30),
                "is_current": False,
            },
        )

        sem1, _ = Semester.objects.get_or_create(
            academic_year=acad_year,
            number=1,
            defaults={
                "name": "First Semester",
                "start_date": date(2026, 9, 1),
                "end_date": date(2027, 1, 20),
                "is_current": True,
            },
        )
        Semester.objects.get_or_create(
            academic_year=acad_year,
            number=2,
            defaults={
                "name": "Second Semester",
                "start_date": date(2027, 2, 10),
                "end_date": date(2027, 6, 30),
                "is_current": False,
            },
        )

        # 2. Departments
        departments_data = [
            {
                "name": "Department of Computer Science and Information Technology",
                "code": "CSIT",
                "faculty": "School of Physical Sciences",
                "head_of_department": "Prof. Kwesi Nkrumah",
                "description": "Software Engineering, Artificial Intelligence, Cybersecurity, and Network Systems at UCC.",
            },
            {
                "name": "Department of Mathematics and Statistics",
                "code": "MATH",
                "faculty": "School of Physical Sciences",
                "head_of_department": "Prof. Esi Mensah-Bonsu",
                "description": "Actuarial Science, Pure & Applied Mathematics, and Statistical Modeling.",
            },
            {
                "name": "Department of Physics and Engineering Sciences",
                "code": "PHYS",
                "faculty": "School of Physical Sciences",
                "head_of_department": "Dr. Kofi Boateng",
                "description": "Engineering Physics, Electronics, Renewable Energy, and Instrumentation.",
            },
            {
                "name": "Department of Accounting and Finance",
                "code": "ACCF",
                "faculty": "School of Business",
                "head_of_department": "Prof. Abena Osei-Tutu",
                "description": "Corporate Finance, Auditing, Financial Technology, and Public Sector Accounting.",
            },
        ]
        dept_objs = {}
        for d in departments_data:
            dept, _ = Department.objects.update_or_create(
                code=d["code"],
                defaults=d,
            )
            dept_objs[d["code"]] = dept

        # 3. Programmes
        programmes_data = [
            {
                "name": "B.Sc. Computer Science",
                "code": "BSC-CSC",
                "department": dept_objs["CSIT"],
                "duration_years": 4,
                "degree_type": "B.Sc.",
            },
            {
                "name": "B.Sc. Information Technology",
                "code": "BSC-INT",
                "department": dept_objs["CSIT"],
                "duration_years": 4,
                "degree_type": "B.Sc.",
            },
            {
                "name": "B.Sc. Actuarial Science",
                "code": "BSC-ACT",
                "department": dept_objs["MATH"],
                "duration_years": 4,
                "degree_type": "B.Sc.",
            },
            {
                "name": "B.Sc. Engineering Physics",
                "code": "BSC-EPH",
                "department": dept_objs["PHYS"],
                "duration_years": 4,
                "degree_type": "B.Sc.",
            },
            {
                "name": "B.Com. Accounting and Finance",
                "code": "BCOM-ACF",
                "department": dept_objs["ACCF"],
                "duration_years": 4,
                "degree_type": "B.Com.",
            },
        ]
        prog_objs = {}
        for p in programmes_data:
            prog, _ = Programme.objects.update_or_create(
                code=p["code"],
                defaults=p,
            )
            prog_objs[p["code"]] = prog

        # 4. Administrator Account
        admin_user, created = User.objects.get_or_create(
            email="awalsarpong4@gmail.com",
            defaults={
                "full_name": "Awal Sarpong",
                "role": "ADMIN",
                "phone_number": "+233 24 410 0001",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        admin_user.set_password("awal0246")
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.is_active = True
        admin_user.role = "ADMIN"
        admin_user.save()

        # 5. Lecturers
        lecturers_data = [
            {
                "email": "kmensah@ucc.edu.gh",
                "full_name": "Kwame Mensah",
                "title": "Dr.",
                "staff_id": "UCC/STAFF/1042",
                "department": dept_objs["CSIT"],
                "specialization": "Distributed Systems & Software Engineering",
                "office_location": "Science Complex Block B, Room 214",
            },
            {
                "email": "aowusu@ucc.edu.gh",
                "full_name": "Ama Serwaa Owusu",
                "title": "Prof.",
                "staff_id": "UCC/STAFF/1088",
                "department": dept_objs["CSIT"],
                "specialization": "Cybersecurity & Cryptography",
                "office_location": "Science Complex Block B, Room 305",
            },
            {
                "email": "edanqwah@ucc.edu.gh",
                "full_name": "Emmanuel Danquah",
                "title": "Dr.",
                "staff_id": "UCC/STAFF/1120",
                "department": dept_objs["MATH"],
                "specialization": "Stochastic Processes & Statistical Inference",
                "office_location": "Physical Sciences Building, Room 109",
            },
        ]
        lecturer_objs = {}
        for l_info in lecturers_data:
            l_user, l_created = User.objects.get_or_create(
                email=l_info["email"],
                defaults={
                    "full_name": l_info["full_name"],
                    "role": "LECTURER",
                    "phone_number": "+233 20 800 1234",
                },
            )
            if l_created:
                l_user.set_password("Lecturer@12345")
                l_user.save()
            LecturerProfile.objects.update_or_create(
                user=l_user,
                defaults={
                    "staff_id": l_info["staff_id"],
                    "title": l_info["title"],
                    "department": l_info["department"],
                    "specialization": l_info["specialization"],
                    "office_location": l_info["office_location"],
                },
            )
            lecturer_objs[l_info["email"]] = l_user

        # 6. Courses
        courses_data = [
            {
                "code": "CSC 301",
                "title": "Software Engineering & System Architecture",
                "description": "Modern software engineering lifecycles, microservices, system design, and automated verification.",
                "credit_hours": 3,
                "level": "300",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "lecturer": lecturer_objs["kmensah@ucc.edu.gh"],
                "semester": sem1,
                "venue": "LT 12 - Science Complex",
                "schedule_day": "Monday",
                "schedule_time": "08:30 AM - 10:30 AM",
                "min_attendance_percentage": 75,
            },
            {
                "code": "CSC 305",
                "title": "Database Management Systems",
                "description": "Relational algebra, PostgreSQL architecture, indexing, ACID transactions, and query optimization.",
                "credit_hours": 3,
                "level": "300",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "lecturer": lecturer_objs["kmensah@ucc.edu.gh"],
                "semester": sem1,
                "venue": "CALC Lab 2 - ICT Centre",
                "schedule_day": "Wednesday",
                "schedule_time": "10:30 AM - 12:30 PM",
                "min_attendance_percentage": 75,
            },
            {
                "code": "CSC 309",
                "title": "Computer Networks & Information Security",
                "description": "TCP/IP stack, cryptographic protocols, zero-trust network architecture, and intrusion detection.",
                "credit_hours": 3,
                "level": "300",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "lecturer": lecturer_objs["aowusu@ucc.edu.gh"],
                "semester": sem1,
                "venue": "LT 14 - Science Complex",
                "schedule_day": "Thursday",
                "schedule_time": "01:30 PM - 03:30 PM",
                "min_attendance_percentage": 75,
            },
            {
                "code": "INF 311",
                "title": "Web & Mobile Enterprise Application Development",
                "description": "Full-stack React, RESTful APIs, WebSockets, and cloud-native deployment pipelines.",
                "credit_hours": 3,
                "level": "300",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-INT"],
                "lecturer": lecturer_objs["kmensah@ucc.edu.gh"],
                "semester": sem1,
                "venue": "Software Engineering Lab 1",
                "schedule_day": "Friday",
                "schedule_time": "09:30 AM - 11:30 AM",
                "min_attendance_percentage": 75,
            },
            {
                "code": "MAT 303",
                "title": "Probability & Statistical Inference",
                "description": "Multivariate distributions, hypothesis testing, Bayesian estimation, and regression models.",
                "credit_hours": 3,
                "level": "300",
                "department": dept_objs["MATH"],
                "programme": prog_objs["BSC-ACT"],
                "lecturer": lecturer_objs["edanqwah@ucc.edu.gh"],
                "semester": sem1,
                "venue": "LT 4 - Old Site Academic Block",
                "schedule_day": "Tuesday",
                "schedule_time": "11:30 AM - 01:30 PM",
                "min_attendance_percentage": 75,
            },
        ]
        course_objs = {}
        for c_info in courses_data:
            c, _ = Course.objects.update_or_create(
                code=c_info["code"],
                defaults=c_info,
            )
            course_objs[c_info["code"]] = c

        # 7. Students
        students_data = [
            {
                "email": "kofi.asante@stu.ucc.edu.gh",
                "full_name": "Kofi Asante",
                "index_number": "PS/CSC/22/0041",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "academic_level": "300",
            },
            {
                "email": "abena.odom@stu.ucc.edu.gh",
                "full_name": "Abena Pokuaa Odom",
                "index_number": "PS/CSC/22/0042",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "academic_level": "300",
            },
            {
                "email": "yaw.boateng@stu.ucc.edu.gh",
                "full_name": "Yaw Frimpong Boateng",
                "index_number": "PS/CSC/22/0043",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "academic_level": "300",
            },
            {
                "email": "akua.mensah@stu.ucc.edu.gh",
                "full_name": "Akua Sarpong Mensah",
                "index_number": "PS/ITC/22/0019",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-INT"],
                "academic_level": "300",
            },
            {
                "email": "nana.agyemang@stu.ucc.edu.gh",
                "full_name": "Nana Kwaku Agyemang",
                "index_number": "PS/CSC/22/0055",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "academic_level": "300",
            },
            {
                "email": "efua.baiden@stu.ucc.edu.gh",
                "full_name": "Efua Blankson Baiden",
                "index_number": "PS/CSC/22/0068",
                "department": dept_objs["CSIT"],
                "programme": prog_objs["BSC-CSC"],
                "academic_level": "300",
            },
        ]
        student_objs = []
        for s_info in students_data:
            s_user, s_created = User.objects.get_or_create(
                email=s_info["email"],
                defaults={
                    "full_name": s_info["full_name"],
                    "role": "STUDENT",
                    "phone_number": "+233 54 321 9876",
                },
            )
            if s_created:
                s_user.set_password("Student@12345")
                s_user.save()
            StudentProfile.objects.update_or_create(
                user=s_user,
                defaults={
                    "index_number": s_info["index_number"],
                    "department": s_info["department"],
                    "programme": s_info["programme"],
                    "academic_level": s_info["academic_level"],
                },
            )
            student_objs.append(s_user)

            # Enroll every seeded student into all 4 CSIT courses + MAT 303
            for c_code in ["CSC 301", "CSC 305", "CSC 309", "INF 311", "MAT 303"]:
                CourseEnrollment.objects.get_or_create(
                    student=s_user,
                    course=course_objs[c_code],
                    defaults={"semester": sem1, "status": "ENROLLED"},
                )

        # 8. Historical & Live Attendance Sessions
        now = timezone.now()
        if AttendanceSession.objects.count() == 0:
            historical_specs = [
                ("CSC 301", "Week 1: Clean Architecture & Domain-Driven Design", 14, [0, 1, 2, 3, 4, 5]),
                ("CSC 301", "Week 2: RESTful API Security & JWT Authentication", 7, [0, 1, 2, 4, 5]),
                ("CSC 305", "Week 1: PostgreSQL Indexing & B-Tree Internals", 10, [0, 1, 2, 3, 5]),
                ("CSC 305", "Week 2: ACID Transactions & Concurrency Control", 4, [0, 1, 3, 4, 5]),
                ("CSC 309", "Week 1: Public Key Infrastructure & TLS 1.3", 5, [0, 1, 2, 3, 4]),
                ("INF 311", "Week 1: Real-Time WebSockets & Django Channels", 2, [0, 2, 3, 4, 5]),
            ]
            for c_code, title, days_ago, attendee_indices in historical_specs:
                course = course_objs[c_code]
                start_t = now - timedelta(days=days_ago, hours=2)
                end_t = start_t + timedelta(minutes=45)
                sess = AttendanceSession.objects.create(
                    course=course,
                    lecturer=course.lecturer,
                    title=title,
                    topic=title,
                    venue=course.venue,
                    start_time=start_t,
                    end_time=end_t,
                    duration_minutes=45,
                    qr_refresh_seconds=60,
                    status="CLOSED",
                )
                for idx in attendee_indices:
                    st = student_objs[idx]
                    AttendanceRecord.objects.create(
                        session=sess,
                        student=st,
                        status="PRESENT",
                        verification_method="QR_SCAN",
                        marked_by=st,
                        ip_address="197.255.120.14",
                        device_info="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
                        remarks="Verified via Cryptographic Classroom QR Scan",
                        timestamp=start_t + timedelta(minutes=4 + idx),
                    )

            # Create one currently ACTIVE live session for CSC 301 so lecturers and students can test immediately
            live_course = course_objs["CSC 301"]
            live_sess = AttendanceSession.objects.create(
                course=live_course,
                lecturer=live_course.lecturer,
                title="Week 3: Real-Time Distributed Systems & QR Telemetry",
                topic="Cryptographic QR Verification & WebSocket Streams",
                venue=live_course.venue,
                start_time=now - timedelta(minutes=5),
                end_time=now + timedelta(minutes=120),
                duration_minutes=120,
                qr_refresh_seconds=120,
                status="ACTIVE",
            )
            QRToken.generate_for_session(live_sess, expiry_seconds=3600)

            # Pre-register 2 students into the live session (leaving Kofi Asante ready to scan or test)
            for idx in [1, 2]:
                st = student_objs[idx]
                AttendanceRecord.objects.create(
                    session=live_sess,
                    student=st,
                    status="PRESENT",
                    verification_method="QR_SCAN",
                    marked_by=st,
                    ip_address="197.255.120.22",
                    device_info="AttendX Mobile Scanner",
                    remarks="Verified via Cryptographic Classroom QR Scan",
                )

            AuditLog.objects.create(
                actor=live_course.lecturer,
                action="SESSION_CREATED",
                session=live_sess,
                new_value="ACTIVE (120 mins)",
                reason="Live classroom lecture session started at LT 12 - Science Complex",
                ip_address="127.0.0.1",
            )

            for st in student_objs:
                Notification.objects.get_or_create(
                    recipient=st,
                    title="Live Attendance Active: CSC 301",
                    message="Dr. Kwame Mensah has started an attendance session for CSC 301 (Software Engineering & System Architecture) at LT 12 - Science Complex.",
                    notification_type="SESSION_STARTED",
                    related_course_code="CSC 301",
                )

        self.stdout.write(self.style.SUCCESS("AttendX UCC seed data loaded successfully!"))

