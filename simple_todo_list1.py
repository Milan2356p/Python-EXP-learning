import json
import os
from datetime import datetime

FILE_NAME = "tasks.json"


def load_tasks():
    if not os.path.exists(FILE_NAME):
        return []

    try:
        with open(FILE_NAME, "r") as file:
            return json.load(file)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_tasks(tasks):
    with open(FILE_NAME, "w") as file:
        json.dump(tasks, file, indent=4)


def display_tasks(tasks):
    if not tasks:
        print("\nNo tasks found.")
        return

    print("\n" + "=" * 60)
    print("                    TO-DO LIST")
    print("=" * 60)

    for task in tasks:
        status = "Completed" if task["completed"] else "Pending"
        due = task["due_date"] if task["due_date"] else "No due date"

        print("ID       :", task["id"])
        print("Task     :", task["title"])
        print("Priority :", task["priority"])
        print("Due Date :", due)
        print("Status   :", status)
        print("-" * 60)


def add_task(tasks):
    title = input("Enter task name: ").strip()

    if not title:
        print("Task name cannot be empty.")
        return

    priority = input("Enter priority (High/Medium/Low): ").strip().capitalize()

    if priority not in ["High", "Medium", "Low"]:
        priority = "Medium"

    due_date = input(
        "Enter due date (DD-MM-YYYY) or press Enter to skip: "
    ).strip()

    if due_date:
        try:
            datetime.strptime(due_date, "%d-%m-%Y")
        except ValueError:
            print("Invalid date format. Due date skipped.")
            due_date = ""

    new_id = max([task["id"] for task in tasks], default=0) + 1

    task = {
        "id": new_id,
        "title": title,
        "priority": priority,
        "due_date": due_date,
        "completed": False
    }

    tasks.append(task)
    save_tasks(tasks)
    print("Task added successfully!")


def update_task(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to update: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:

            new_title = input(
                f'Enter new task name [{task["title"]}]: '
            ).strip()

            if new_title:
                task["title"] = new_title

            new_priority = input(
                f'Enter priority (High/Medium/Low) [{task["priority"]}]: '
            ).strip().capitalize()

            if new_priority in ["High", "Medium", "Low"]:
                task["priority"] = new_priority

            new_due = input(
                f'Enter due date [{task["due_date"] or "None"}]: '
            ).strip()

            if new_due:
                try:
                    datetime.strptime(new_due, "%d-%m-%Y")
                    task["due_date"] = new_due
                except ValueError:
                    print("Invalid date. Old due date kept.")

            save_tasks(tasks)
            print("Task updated successfully!")
            return

    print("Task ID not found.")


def mark_completed(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to mark completed: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:
            task["completed"] = True
            save_tasks(tasks)
            print("Task marked as completed!")
            return

    print("Task ID not found.")


def delete_task(tasks):
    if not tasks:
        print("No tasks available.")
        return

    display_tasks(tasks)

    try:
        task_id = int(input("Enter task ID to delete: "))
    except ValueError:
        print("Please enter a valid ID.")
        return

    for task in tasks:
        if task["id"] == task_id:
            tasks.remove(task)
            save_tasks(tasks)
            print("Task deleted successfully!")
            return

    print("Task ID not found.")


def main():
    tasks = load_tasks()

    while True:
        print("\n========== SIMPLE TO-DO LIST ==========")
        print("1. Add Task")
        print("2. View Tasks")
        print("3. Update Task")
        print("4. Mark Task as Completed")
        print("5. Delete Task")
        print("6. Exit")
        print("=======================================")

        choice = input("Enter your choice (1-6): ").strip()

        if choice == "1":
            add_task(tasks)
        elif choice == "2":
            display_tasks(tasks)
        elif choice == "3":
            update_task(tasks)
        elif choice == "4":
            mark_completed(tasks)
        elif choice == "5":
            delete_task(tasks)
        elif choice == "6":
            print("Thank you for using the To-Do List!")
            break
        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()
